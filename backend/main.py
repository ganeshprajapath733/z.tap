from fastapi import FastAPI, HTTPException, Request
from models import Signal
from redis_client import redis_client
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from db import SessionLocal
from models_db import WorkItem
from datetime import datetime
import json

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_TRANSITIONS = {
    "OPEN": ["INVESTIGATING"],
    "INVESTIGATING": ["RESOLVED"],
    "RESOLVED": ["CLOSED"],
    "CLOSED": []
}

@app.get("/")
def read_root():
    return {"message": "IMS Backend Running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/v1/ingest")
@limiter.limit("1000/minute")
async def ingest_signal(request: Request, signal: Signal):
    try:
        encoded_signal = jsonable_encoder(signal)
        redis_client.lpush("signal_queue", json.dumps(encoded_signal))
        return {"status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/work_item/{item_id}")
def update_work_item(item_id: int, status: str, rca: str = None):
    db = SessionLocal()
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()

    if not item:
        db.close()
        raise HTTPException(status_code=404, detail="Work item not found")

    new_status = status.upper()
    current_status = item.status

    if current_status == "CLOSED":
        db.close()
        raise HTTPException(status_code=400, detail="Cannot update CLOSED incident")

    if new_status not in VALID_TRANSITIONS.get(current_status, []):
        db.close()
        raise HTTPException(status_code=400, detail=f"Invalid transition: {current_status} → {new_status}")

    if new_status == "CLOSED":
        if not rca or rca.strip() == "" or rca.lower() == "rca":
            db.close()
            raise HTTPException(status_code=400, detail="Valid RCA is required before closing")

    item.status = new_status

    if new_status == "RESOLVED":
        item.resolved_at = datetime.utcnow()

    if rca:
        item.rca = rca

    db.commit()

    mttr = None
    if item.resolved_at:
        mttr = (item.resolved_at - item.created_at).total_seconds()

    db.close()

    return {"message": "updated", "mttr_seconds": mttr}

@app.get("/api/v1/work_items")
def get_work_items():
    db = SessionLocal()
    items = db.query(WorkItem).all()
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "component_id": item.component_id,
            "status": item.status,
            "created_at": item.created_at,
            "resolved_at": item.resolved_at,
            "rca": item.rca
        })
    db.close()
    return result