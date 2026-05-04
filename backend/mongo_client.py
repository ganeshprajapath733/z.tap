from pymongo import MongoClient

# YOU ARE RUNNING WORKER LOCALLY → USE THIS
client = MongoClient("mongodb://localhost:27017")

db = client["ims_db"]

signals_collection = db["signals"]