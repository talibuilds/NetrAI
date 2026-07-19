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

def predict_health_score(health_score: float, traffic_volume: int, rainfall_mm: int, road_age_days: int, recent_damage_events: int) -> dict:
    """
    Returns a dictionary with the 30-day forecast, risk level, and estimated days until critical failure (0).
    """
    if _model is None:
        return {
            "future_health": health_score,
            "risk_level": "Unknown",
            "predicted_repair_date_days": -1
        }
        
    df = pd.DataFrame([{
        'current_health': health_score,
        'traffic_volume': traffic_volume,
        'rainfall_mm': rainfall_mm,
        'road_age_days': road_age_days,
        'recent_damage_events': recent_damage_events
    }])
    
    pred_t30 = _model.predict(df)[0]
    pred_t30 = max(0.0, min(100.0, float(pred_t30)))
    
    if pred_t30 > 70:
        risk = "Healthy"
    elif pred_t30 > 40:
        risk = "Medium"
    else:
        risk = "Critical"
        
    # Extrapolate days to 0 based on the 30-day decay rate
    decay_30d = health_score - pred_t30
    if decay_30d <= 0:
        days_to_zero = 999
    else:
        daily_decay = decay_30d / 30.0
        days_to_zero = int(pred_t30 / daily_decay)
        
    return {
        "future_health": round(pred_t30, 2),
        "risk_level": risk,
        "predicted_repair_date_days": days_to_zero
    }
