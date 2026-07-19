import os
import time
import requests

def test_live_flow():
    # Allow the user to provide the deployed URL or fallback to localhost for sanity check
    base_url = os.getenv("NETRAI_API_URL", "http://127.0.0.1:8000")
    print(f"Testing flow against {base_url} ...")

    # 1. Check Root Endpoint
    try:
        resp = requests.get(f"{base_url}/")
        resp.raise_for_status()
        print("✅ Root endpoint ok:", resp.json())
    except Exception as e:
        print(f"❌ Failed to reach {base_url}/: {e}")
        return

    # 2. Upload a dummy image to /report
    # We will simulate the Android upload of a JPEG file.
    dummy_image_data = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x10\x00\x10\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xd2\xcf \xff\xd9"
    files = {
        'image': ('dummy.jpg', dummy_image_data, 'image/jpeg')
    }
    data = {
        'lat': '12.971598',
        'lng': '77.594562',
        'type': 'pothole',
        'severity_score': '50',
        'time': str(time.time() * 1000)
    }

    print("\nSimulating POST /report ...")
    try:
        resp = requests.post(f"{base_url}/report", files=files, data=data)
        resp.raise_for_status()
        report_data = resp.json()
        print("✅ Report submitted:", report_data)
        print(f"   Image URL: {report_data.get('image_url')}")
    except Exception as e:
        print(f"❌ Failed to submit report: {e}")
        if 'resp' in locals():
            print("Response:", resp.text)
        return

    # 3. Check /assets (Track layer)
    print("\nFetching GET /assets ...")
    try:
        resp = requests.get(f"{base_url}/assets")
        resp.raise_for_status()
        print(f"✅ Fetched {len(resp.json())} assets")
    except Exception as e:
        print(f"❌ Failed to fetch assets: {e}")
        if 'resp' in locals():
            print("Response:", resp.text)

    # 4. Check /prioritize (Predict layer)
    print("\nFetching GET /prioritize ...")
    try:
        resp = requests.get(f"{base_url}/prioritize?limit=5")
        resp.raise_for_status()
        prioritize_data = resp.json()
        print(f"✅ Prioritize results: {len(prioritize_data)} items")
        if prioritize_data:
            print("   Top asset:", prioritize_data[0])
    except Exception as e:
        print(f"❌ Failed to fetch prioritize: {e}")
        if 'resp' in locals():
            print("Response:", resp.text)
    
    print("\nAll live flow tests finished!")

if __name__ == "__main__":
    test_live_flow()
