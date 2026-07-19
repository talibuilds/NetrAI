import os
import pickle
import pandas as pd
from .config import BASE_DIR

MODEL_PATH = BASE_DIR / "health_forecast_xgb.pkl"
_model = None

def load_predict_model():
    global _model
    if not MODEL_PATH.exists():
        print(f"[predict] model not found at {MODEL_PATH}")
        return
    with open(MODEL_PATH, "rb") as f:
        _model = pickle.load(f)
    print(f"[predict] loaded XGBoost model from {MODEL_PATH}")

def predict_health_score(health_score: float, traffic_volume: int, nearby_pois: int) -> float:
    if _model is None:
        # Fallback heuristic if model isn't loaded
        decay = (traffic_volume / 10000.0) * 5.0 + (100 - health_score) * 0.1 + (nearby_pois * 0.5)
        return max(0.0, health_score - decay)
        
    df = pd.DataFrame({
        'health_score': [health_score],
        'traffic_volume': [traffic_volume],
        'nearby_pois': [nearby_pois]
    })
    
    pred = _model.predict(df)[0]
    return max(0.0, min(100.0, float(pred)))
