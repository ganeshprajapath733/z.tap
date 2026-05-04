import time
import json
from unittest import result
from redis_client import redis_client
from mongo_client import signals_collection
from db import SessionLocal
from models_db import WorkItem


def process_signal(signal_data):
    signal = json.loads(signal_data)
    component_id = signal["component_id"]

    # Store raw signal in MongoDB
    print("[DEBUG] inserting:", signal)

    result = signals_collection.insert_one(signal)

    print("[DEBUG] inserted_id:", result.inserted_id)

    counter_key = f"counter:{component_id}"
    redis_client.incr(counter_key)

    # ACTIVE INCIDENT LOGIC
    active_key = f"active_incident:{component_id}"
    active_incident = redis_client.get(active_key)

    if not active_incident:
        db = SessionLocal()

        work_item = WorkItem(
            component_id=component_id,
            status="OPEN"
        )

        db.add(work_item)
        db.commit()
        db.refresh(work_item)

        # store active incident id
        redis_client.set(active_key, work_item.id)

        db.close()

        print(f"\n[WORK ITEM CREATED + STORED] for {component_id}")

    else:
        print(f"[DEBOUNCED - EXISTING INCIDENT] {component_id}")


def worker_loop():
    print("Worker started...")

    while True:
        try:
            _, signal_data = redis_client.brpop("signal_queue")
            process_signal(signal_data)

        except Exception as e:
            print("Worker error:", e)

        time.sleep(0.1)


if __name__ == "__main__":
    worker_loop()
    
print("[DEBUG] Mongo DB:", signals_collection.database.name)
print("[DEBUG] Collection:", signals_collection.name)