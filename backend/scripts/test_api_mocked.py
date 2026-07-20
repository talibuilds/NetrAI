import json
import random
from datetime import datetime, timezone
from fastapi.testclient import TestClient
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.main import app, _state, ASSETS_COLL, MONGO_COLL
from src.predict import load_predict_model

client = TestClient(app)

class MockCollection:
    def __init__(self, data=None):
        self.data = data or []
    def find(self, query):
        return self.data
    def find_one(self, query):
        for doc in self.data:
            if doc.get("_id") == query.get("_id"):
                return doc
        return None

class MockDB:
    def __init__(self):
        # Create some synthetic locations with varying data
        self.assets = MockCollection([
            {
                "_id": "asset_12.34,56.78",
                "name": "High Traffic Old Road",
                "health_score": 85.0,
                "traffic_volume": 18000,
                "rainfall_mm": 120,
                "road_age_days": 2500,
                "recent_damage_events": 3,
                "health_history": [{"date": datetime.now(timezone.utc), "score": 85.0}]
            },
            {
                "_id": "asset_11.11,22.22",
                "name": "Low Traffic New Road",
                "health_score": 98.0,
                "traffic_volume": 800,
                "rainfall_mm": 20,
                "road_age_days": 150,
                "recent_damage_events": 0,
                "health_history": [{"date": datetime.now(timezone.utc), "score": 98.0}]
            },
            {
                "_id": "asset_99.99,88.88",
                "name": "Critical Failing Road",
                "health_score": 42.0,
                "traffic_volume": 12000,
                "rainfall_mm": 200,
                "road_age_days": 3500,
                "recent_damage_events": 8,
                "health_history": [{"date": datetime.now(timezone.utc), "score": 42.0}]
            }
        ])
        
        self.reports = MockCollection([
            {
                "_id": "rep_1",
                "location": {"coordinates": [12.34, 56.78]},
                "type": "pothole",
                "severity_score": 0.85,
                "status": "pending",
                "time": datetime.now(timezone.utc)
            }
        ])
        
    def __getitem__(self, item):
        if item == ASSETS_COLL: return self.assets
        if item == MONGO_COLL: return self.reports
        return MockCollection()

def test_endpoints():
    print("Mocking MongoDB...")
    _state["mongo"] = MockDB()
    
    print("Loading XGBoost model synchronously for tests...")
    load_predict_model()
    
    print("\n--- Testing GET /prioritize ---")
    response = client.get("/prioritize?limit=3")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    print("\n--- Testing GET /reports/rep_1 ---")
    response = client.get("/reports/rep_1")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    test_endpoints()
