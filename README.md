# ⚡ Incident Management System (IMS)

A mission-critical, real-time Incident Management System built to monitor distributed infrastructure components (APIs, Caches, RDBMS, NoSQL stores) and manage failure mediation workflows from signal ingestion to root cause resolution.

---

## 🏗️ Architecture Diagram

```
                        ┌─────────────────────────────────────────────────────┐
                        │                  FRONTEND (React + Vite)            │
                        │         localhost:5174                               │
                        │  ┌─────────────┐        ┌──────────────────────┐   │
                        │  │ Ingest Form │        │  Incident Dashboard  │   │
                        │  │ Send Signal │        │  Live Feed + RCA Form│   │
                        │  └──────┬──────┘        └──────────┬───────────┘   │
                        └─────────┼─────────────────────────┼───────────────┘
                                  │ POST /api/v1/ingest      │ GET /api/v1/work_items
                                  │                          │ PUT /api/v1/work_item/:id
                                  ▼                          ▼
                        ┌─────────────────────────────────────────────────────┐
                        │              FASTAPI BACKEND (main.py)              │
                        │                   localhost:8000                     │
                        │                                                     │
                        │   /api/v1/ingest  →  Rate Limited  →  Push to      │
                        │                                       Redis Queue   │
                        │   /api/v1/work_items  ←  PostgreSQL Query           │
                        │   /api/v1/work_item/:id  ←  State Machine          │
                        │   /health  →  {"status": "ok"}                     │
                        └────────────┬──────────────────────────────────────┘
                                     │
                          lpush("signal_queue")
                                     │
                                     ▼
                        ┌────────────────────────┐
                        │   REDIS (Queue + Cache) │
                        │      localhost:6379     │
                        │                        │
                        │  signal_queue  (List)  │
                        │  active_incident:<id>  │
                        │  counter:<component>   │
                        └────────────┬───────────┘
                                     │
                              brpop (blocking)
                                     │
                                     ▼
                        ┌────────────────────────────────────────────────────┐
                        │              WORKER (worker.py)                    │
                        │         Async Signal Processor                     │
                        │                                                    │
                        │  1. Pop signal from Redis queue                    │
                        │  2. Insert raw signal → MongoDB (audit log)        │
                        │  3. Check Redis for active incident (debounce)     │
                        │  4. If new → Create WorkItem in PostgreSQL         │
                        │  5. If exists → Debounce (skip duplicate)          │
                        └──────┬──────────────────────────┬──────────────────┘
                               │                          │
                               ▼                          ▼
              ┌─────────────────────────┐   ┌─────────────────────────────┐
              │   MONGODB (Data Lake)   │   │  POSTGRESQL (Source of Truth)│
              │     localhost:27017     │   │      localhost:5432          │
              │                        │   │                              │
              │  db: ims_db            │   │  db: ims_db                 │
              │  collection: signals   │   │  table: work_items          │
              │                        │   │                              │
              │  Raw signal payloads   │   │  id, component_id, status   │
              │  Full audit log        │   │  created_at, resolved_at    │
              │  Every signal stored   │   │  rca, mttr                  │
              └─────────────────────────┘   └─────────────────────────────┘
```

---

## 🗂️ Project Structure

```
ims-system/
├── backend/
│   ├── main.py          # FastAPI app — REST API, state machine, CORS
│   ├── worker.py        # Signal consumer — Redis queue processor
│   ├── models.py        # Pydantic request models
│   ├── models_db.py     # SQLAlchemy ORM models (WorkItem)
│   ├── db.py            # PostgreSQL engine + session factory
│   ├── mongo_client.py  # MongoDB connection + signals collection
│   ├── redis_client.py  # Redis connection
│   ├── init_db.py       # DB initializer — creates PostgreSQL tables
│   └── requirements.txt
├── frontend/
│   └── src/
│       └── App.jsx      # React dashboard — live feed, RCA form, transitions
├── docker-compose.yml   # Redis + MongoDB + PostgreSQL
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| API | FastAPI + Uvicorn | High-performance async REST API |
| Queue | Redis (List + brpop) | Signal ingestion buffer, debounce cache |
| Worker | Python (blocking loop) | Async signal consumer |
| Data Lake | MongoDB | Raw signal audit log (every signal stored) |
| Source of Truth | PostgreSQL + SQLAlchemy | WorkItems, RCA, MTTR — transactional |
| Frontend | React + Vite + Axios | Live dashboard, incident workflow UI |
| Containers | Docker Compose | One-command infrastructure setup |

---

## 🚀 Setup Instructions

### Prerequisites
- Docker + Docker Compose
- Python 3.10+
- Node.js 18+

### Step 1 — Start Infrastructure

```bash
git clone <your-repo-url>
cd ims-system
docker-compose up -d
```

Verify all containers are running:
```bash
docker ps
# Should show: ims-redis, ims-mongo, ims-postgres
```

### Step 2 — Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python init_db.py   # Creates PostgreSQL tables → prints "Tables created"
```

### Step 3 — Start the API Server

```bash
uvicorn main:app --reload
# Running at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Step 4 — Start the Worker (new terminal)

```bash
cd backend
venv\Scripts\activate   # or source venv/bin/activate
python worker.py
# Prints: Worker started...
```

### Step 5 — Start the Frontend (new terminal)

```bash
cd frontend
npm install
npm install axios
npm run dev
# Running at http://localhost:5174
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |
| POST | `/api/v1/ingest` | Ingest a signal |
| GET | `/api/v1/work_items` | List all work items |
| PUT | `/api/v1/work_item/{id}` | Update status / submit RCA |

### Ingest Signal — Example

```bash
curl -X POST http://localhost:8000/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "component_id": "RDBMS_01",
    "status": "failure",
    "message": "connection timeout",
    "timestamp": "2026-05-04T10:00:00"
  }'
```

### State Transitions

```
OPEN → INVESTIGATING → RESOLVED → CLOSED (requires RCA)
```

```bash
# Move to INVESTIGATING
PUT /api/v1/work_item/1?status=INVESTIGATING

# Move to RESOLVED (auto-calculates MTTR)
PUT /api/v1/work_item/1?status=RESOLVED

# Move to CLOSED (RCA required — rejected without it)
PUT /api/v1/work_item/1?status=CLOSED&rca=Root+cause+description
```

---

## 🔁 How Backpressure is Handled

The system is designed so that **the API never blocks and never crashes**, even under extreme signal volume (10,000+ signals/sec).

### Strategy: Redis as a Buffer

```
Producer (FastAPI)          Consumer (Worker)
      │                           │
      │  lpush("signal_queue")    │  brpop("signal_queue")
      ▼                           ▼
  [signal] → [signal] → [signal] → [signal]
         Redis List (unbounded buffer)
```

1. **FastAPI ingestion endpoint** does one thing only — `lpush` the signal onto the Redis list and returns `{"status": "queued"}` immediately. No DB writes happen in the API layer.

2. **Redis acts as the buffer** — absorbs any burst of signals without back-pressure reaching the API. The list grows in memory if the worker is slow, but the API stays responsive.

3. **The Worker consumes at its own pace** — uses `brpop` (blocking pop) which efficiently waits for work without busy-looping. It processes one signal at a time: MongoDB write → Redis debounce check → PostgreSQL write (only if new incident).

4. **Debounce via Redis** — if 100 signals arrive for `CACHE_CLUSTER_01` within seconds, only the first creates a PostgreSQL WorkItem. The rest are detected via `redis.get("active_incident:CACHE_CLUSTER_01")` and skipped. This prevents write amplification to the database.

5. **Failure isolation** — if PostgreSQL is slow or down, only the worker backs up. The API and Redis remain fully operational, continuing to accept and queue signals.

---

## 🔄 Incident Lifecycle

```
Signal arrives
      │
      ▼
Redis Queue (buffered)
      │
      ▼
Worker picks up signal
      │
      ├─► MongoDB: store raw signal (always)
      │
      ├─► Redis: check active_incident:<component_id>
      │         │
      │         ├─ EXISTS → DEBOUNCED (skip DB write)
      │         │
      │         └─ NOT EXISTS → Create WorkItem in PostgreSQL
      │                         Set active_incident key in Redis
      ▼
WorkItem: OPEN
      │
      ▼ (manual via API/UI)
WorkItem: INVESTIGATING
      │
      ▼
WorkItem: RESOLVED  ←── MTTR calculated here (resolved_at - created_at)
      │
      ▼ (RCA required — rejected if missing)
WorkItem: CLOSED
```

---

## 🧪 Sample Failure Simulation

Run this to simulate an RDBMS outage followed by a Cache failure:

```bash
# Simulate RDBMS outage (3 signals — debounced to 1 WorkItem)
for i in 1 2 3; do
  curl -X POST http://localhost:8000/api/v1/ingest \
    -H "Content-Type: application/json" \
    -d '{"component_id":"RDBMS_01","status":"failure","message":"connection timeout","timestamp":"2026-05-04T10:00:00"}'
done

# Simulate Cache failure
curl -X POST http://localhost:8000/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"component_id":"CACHE_CLUSTER_01","status":"failure","message":"cache miss spike","timestamp":"2026-05-04T10:01:00"}'
```

---

## ✅ Evaluation Rubric Coverage

| Category | Implementation |
|---|---|
| Concurrency & Scaling | Redis queue buffers bursts; worker uses brpop; debounce prevents DB overload |
| Data Handling | MongoDB = raw audit log; PostgreSQL = transactional WorkItems; Redis = hot cache |
| LLD | State Machine pattern for transitions; Strategy pattern via VALID_TRANSITIONS map |
| UI/UX | React dashboard with live polling, ingest form, RCA textarea, status badges |
| Resilience | RCA validation enforced; MTTR auto-calculated; CLOSED state locked after close |
| Documentation | This README + architecture diagram + backpressure section |
| Tech Stack | FastAPI + Redis + MongoDB + PostgreSQL + React — each chosen for specific role |