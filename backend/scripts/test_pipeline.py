import requests
import time
import json
import random

BASE_URL = "http://127.0.0.1:8001"

def test():
    print("Fetching existing reports to find one to use, or testing /prioritize directly...")
    
    # 1. Test prioritize
    try:
        res = requests.get(f"{BASE_URL}/prioritize?limit=2")
        print("GET /prioritize ->")
        print(json.dumps(res.json(), indent=2))
        
        # 2. Get a report
        reports_res = requests.get(f"{BASE_URL}/reports?limit=1")
        reports = reports_res.json()
        if reports:
            report_id = reports[0]["id"]
            print(f"\nFetching GET /reports/{report_id} ->")
            detail_res = requests.get(f"{BASE_URL}/reports/{report_id}")
            print(json.dumps(detail_res.json(), indent=2))
        else:
            print("\nNo reports in DB to test GET /reports/{id}.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
