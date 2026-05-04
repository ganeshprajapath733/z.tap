import time
import json
from redis_client import redis_client
from mongo_client import signals_collection
from db import SessionLocal
from models_db import WorkItem

# Throughput tracking
signal_count = 0
last_report_time = time.time()

def report_throughput():
    global signal_count, last_report_time
    now = time.time()
    elapsed = now - last_report_time
    if elapsed >= 5:
        rate = signal_count / elapsed
        print(f"[THROUGHPUT] {rate:.2f} signals/sec (last {elapsed:.1f}s)")
        signal_count = 0
        last_report_time = now

def process_signal(signal_data):
    global signal_count
    signal_count += 1

    signal = json.loads(signal_data)
    component_id = signal["component_id"]

    print("[DEBUG] inserting:", signal)
    result = signals_collection.insert_one(signal)
    print("[DEBUG] inserted_id:", result.inserted_id)

    counter_key = f"counter:{component_id}"
    redis_client.incr(counter_key)

    active_key = f"active_incident:{component_id}"
    active_incident = redis_client.get(active_key)

    if not active_incident:
        db = SessionLocal()
        work_item = WorkItem(component_id=component_id, status="OPEN")
        db.add(work_item)
        db.commit()
        db.refresh(work_item)
        redis_client.set(active_key, work_item.id)
        db.close()
        print(f"\n[WORK ITEM CREATED + STORED] for {component_id}")
    else:
        print(f"[DEBOUNCED - EXISTING INCIDENT] {component_id}")

def worker_loop():
    print("Worker started...")
    while True:
        try:
            result = redis_client.brpop("signal_queue", timeout=5)
            if result:
                _, signal_data = result
                process_signal(signal_data)
            report_throughput()
        except Exception as e:
            print("Worker error:", e)

if __name__ == "__main__":
    worker_loop()