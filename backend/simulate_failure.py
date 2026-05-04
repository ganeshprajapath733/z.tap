import requests
import time

BASE_URL = "http://localhost:8000/api/v1"

def send_signal(component_id, status, message):
    res = requests.post(f"{BASE_URL}/ingest", json={
        "component_id": component_id,
        "status": status,
        "message": message,
        "timestamp": "2026-05-04T10:00:00"
    })
    print(f"[SIGNAL] {component_id} → {res.json()}")

print("=== Simulating RDBMS Outage ===")
for i in range(5):
    send_signal("RDBMS_01", "failure", "connection timeout")
    time.sleep(0.2)

print("\n=== Simulating Cache Failure ===")
for i in range(3):
    send_signal("CACHE_CLUSTER_01", "failure", "cache miss spike")
    time.sleep(0.2)

print("\n=== Simulating MCP Failure ===")
for i in range(3):
    send_signal("MCP_HOST_01", "failure", "MCP host unreachable")
    time.sleep(0.2)

print("\n=== Simulation Complete ===")
print("Check worker logs for DEBOUNCE behaviour")
print("Check dashboard at http://localhost:5174")