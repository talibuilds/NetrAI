"""
Generate a synthetic dataset of road health degradation over time and train an XGBoost regressor
to predict a location's health score 30 days into the future.
"""

import os
import random
import pickle
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Ensure we're in the right directory relative to this script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "health_forecast_xgb.pkl")

NUM_LOCATIONS = 150
MONTHS = 24

def generate_synthetic_data() -> pd.DataFrame:
    """
    Simulates ~150 locations over ~24 months.
    Assumptions driving health-score decay:
    - High traffic volume accelerates wear.
    - High rainfall causes water damage and expands micro-cracks.
    - Older roads (higher road_age_days) decay faster as materials weaken.
    - More recent damage events act as stress multipliers (e.g., untreated potholes spread).
    """
    records = []
    
    for loc_id in range(NUM_LOCATIONS):
        # Base characteristics for the location
        base_traffic = random.randint(500, 20000) # Cars per day
        base_age = random.randint(0, 3650)        # 0 to 10 years old
        
        # Start with a healthy road (mostly)
        current_health = random.uniform(85.0, 100.0)
        
        for month in range(MONTHS):
            # Vary conditions slightly by month
            traffic_volume = max(0, int(np.random.normal(base_traffic, base_traffic * 0.1)))
            rainfall_mm = max(0, int(np.random.normal(50, 30))) # 50mm avg, varies widely
            road_age_days = base_age + (month * 30)
            
            # Damage events are rare but increase as health drops
            damage_prob = max(0.01, (100 - current_health) / 200.0)
            recent_damage_events = np.random.binomial(5, damage_prob)
            
            # -- DECAY LOGIC (Domain assumptions) --
            # Base monthly decay is minimal for empty, new roads (~0.5 points)
            decay = 0.5
            decay += (traffic_volume / 10000.0) * 2.0  # +2 points per 10k cars
            decay += (rainfall_mm / 100.0) * 1.5       # +1.5 points per 100mm rain
            decay += (road_age_days / 365.0) * 0.5     # +0.5 points per year of age
            decay += (recent_damage_events * 2.0)      # +2 points per unpatched pothole/event
            
            # Add some natural randomness/noise
            decay *= random.uniform(0.8, 1.2)
            
            health_t30 = max(0.0, current_health - decay)
            
            records.append({
                "location_id": f"loc_{loc_id}",
                "month": month,
                "current_health": current_health,
                "traffic_volume": traffic_volume,
                "rainfall_mm": rainfall_mm,
                "road_age_days": road_age_days,
                "recent_damage_events": recent_damage_events,
                "health_t30": health_t30
            })
            
            # Step forward for next month
            current_health = health_t30

    return pd.DataFrame(records)

def main():
    print("Generating synthetic dataset...")
    df = generate_synthetic_data()
    print(f"Generated {len(df)} records.")
    
    # Features and Target
    features = ['current_health', 'traffic_volume', 'rainfall_mm', 'road_age_days', 'recent_damage_events']
    X = df[features]
    y = df['health_t30']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=100, 
        max_depth=5, 
        learning_rate=0.1, 
        objective='reg:squarederror'
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    preds = model.predict(X_test)
    mse = mean_squared_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    print(f"Model Evaluation - MSE: {mse:.4f}, R²: {r2:.4f}")
    
    # Save the model
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"Successfully saved model to {MODEL_PATH}")
    
    # Sanity check prediction
    print("\nSanity Check Prediction:")
    sample = pd.DataFrame([{
        'current_health': 80.0,
        'traffic_volume': 15000,
        'rainfall_mm': 120,
        'road_age_days': 1500,
        'recent_damage_events': 2
    }])
    pred_t30 = model.predict(sample)[0]
    print(f"Input: {sample.to_dict(orient='records')[0]}")
    print(f"Predicted T+30 Health: {pred_t30:.2f} (Expected ~71-73)")

if __name__ == "__main__":
    main()
