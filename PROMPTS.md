# Prompts, Specs & Plans

This document contains the prompts, specifications, and planning used to build the Incident Management System (IMS).

---

## Assignment Spec

The assignment required building a mission-critical Incident Management System (IMS) to:
- Ingest high-throughput signals from distributed infrastructure components
- Process and debounce signals using Redis
- Store raw signals in MongoDB (audit log) and structured WorkItems in PostgreSQL
- Provide a workflow engine with state transitions (OPEN → INVESTIGATING → RESOLVED → CLOSED)
- Build a React dashboard with live feed, incident detail, and RCA form
- Handle backpressure, rate limiting, and observability

---

## System Design Plan

### Tech Stack Decisions

| Component | Choice | Reason |
|---|---|---|
| API | FastAPI | Async, high performance, auto Swagger docs |
| Queue | Redis List + brpop | In-memory buffer for burst ingestion |
| Data Lake | MongoDB | Schema-free, high write throughput for raw signals |
| Source of Truth | PostgreSQL | ACID transactions for WorkItems and RCA |
| Cache | Redis | Hot-path for active incident deduplication |
| Frontend | React + Vite | Fast, component-based, easy axios integration |
| Containers | Docker Compose | One-command setup for all infrastructure |

### Architecture Decisions

1. **Separation of Producer and Consumer** — FastAPI only queues signals to Redis. Worker separately consumes them. This decouples ingestion from persistence.

2. **Debounce via Redis** — `active_incident:<component_id>` key in Redis prevents duplicate WorkItems. Only the first signal creates a WorkItem; subsequent signals are debounced.

3. **State Machine Pattern** — `VALID_TRANSITIONS` dict enforces legal state changes. Invalid transitions are rejected with HTTP 400.

4. **Mandatory RCA** — CLOSED transition is blocked if RCA is missing or empty.

5. **MTTR** — Calculated automatically as `resolved_at - created_at` in seconds.

---

## Prompts Used

### Prompt 1 — Initial Architecture
```
I need to build a mission-critical Incident Management System. 
It should ingest signals via FastAPI, queue them in Redis, 
process them in a worker, store raw signals in MongoDB, 
and store WorkItems in PostgreSQL. Help me design the architecture.
```

### Prompt 2 — Worker + Debounce Logic
```
Write a Python worker that consumes from a Redis queue using brpop,
inserts raw signals into MongoDB, and creates WorkItems in PostgreSQL
only if no active incident exists for that component_id (debounce via Redis).
```

### Prompt 3 — State Machine
```
Implement a state machine for WorkItem transitions: 
OPEN → INVESTIGATING → RESOLVED → CLOSED.
Reject invalid transitions with HTTP 400.
Block CLOSED transition if RCA is missing.
Calculate MTTR when status moves to RESOLVED.
```

### Prompt 4 — React Dashboard
```
Build a React dashboard for the IMS system with:
- Live incident feed polling every 5 seconds
- Ingest signal form
- Click incident to see detail panel
- State transition buttons
- RCA textarea required for CLOSED transition
Dark theme, monospace font, professional look.
```

### Prompt 5 — Rate Limiting + Throughput
```
Add slowapi rate limiting (1000/minute) to the FastAPI ingest endpoint.
Add throughput metrics to the worker that prints signals/sec every 5 seconds.
```

### Prompt 6 — Simulation Script
```
Write a Python script that simulates:
- RDBMS outage (5 signals to RDBMS_01)
- Cache failure (3 signals to CACHE_CLUSTER_01)  
- MCP failure (3 signals to MCP_HOST_01)
With 0.2s delay between signals to show debounce working.
```

---

## Files Checklist

- `backend/main.py` — FastAPI app, rate limiting, state machine, CORS
- `backend/worker.py` — Signal consumer, debounce, throughput metrics
- `backend/models.py` — Pydantic signal model
- `backend/models_db.py` — SQLAlchemy WorkItem model
- `backend/db.py` — PostgreSQL engine
- `backend/mongo_client.py` — MongoDB connection
- `backend/redis_client.py` — Redis connection
- `backend/init_db.py` — Table creation script
- `backend/simulate_failure.py` — Failure simulation script
- `backend/requirements.txt` — Python dependencies
- `frontend/src/App.jsx` — React dashboard
- `docker-compose.yml` — Infrastructure setup
- `README.md` — Architecture, setup, backpressure
- `PROMPTS.md` — This file