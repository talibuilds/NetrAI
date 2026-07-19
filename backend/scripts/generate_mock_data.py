import os
import sys
import math
from pymongo import MongoClient

# Add src to path so we can import config
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from src.config import MONGO_URI, MONGO_DB, ASSETS_COLL

def generate_grid():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    coll = db[ASSETS_COLL]
    
    # Bangalore center
    center_lat = 12.9716
    center_lng = 77.5946
    
    # Grid parameters
    grid_size = 5
    step = 0.02 # approx 2km
    
    start_lat = center_lat - (grid_size / 2) * step
    start_lng = center_lng - (grid_size / 2) * step
    
    assets = []
    for i in range(grid_size):
        for j in range(grid_size):
            lat1 = start_lat + i * step
            lng1 = start_lng + j * step
            lat2 = lat1 + step
            lng2 = lng1 + step
            
            asset_id = f"zone_{i}_{j}"
            # GeoJSON Polygon (requires starting and ending at the same point)
            polygon = {
                "type": "Polygon",
                "coordinates": [[
                    [lng1, lat1],
                    [lng2, lat1],
                    [lng2, lat2],
                    [lng1, lat2],
                    [lng1, lat1]
                ]]
            }
            
            # mock traffic and POIs
            traffic_volume = 1000 + (i * j * 500) % 10000
            nearby_pois = (i + j) % 5
            
            assets.append({
                "_id": asset_id,
                "name": f"Zone {i}-{j}",
                "geometry": polygon,
                "health_score": 100.0,
                "traffic_volume": traffic_volume,
                "nearby_pois": nearby_pois
            })
            
    # clear existing
    coll.delete_many({})
    coll.insert_many(assets)
    # create geospatial index
    coll.create_index([("geometry", "2dsphere")])
    print(f"Inserted {len(assets)} assets and created 2dsphere index on {ASSETS_COLL}")

if __name__ == "__main__":
    generate_grid()
