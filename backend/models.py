from pydantic import BaseModel
from datetime import datetime

class Signal(BaseModel):
    component_id: str
    status: str   # "failure" | "warning" | "ok"
    message: str
    timestamp: datetime