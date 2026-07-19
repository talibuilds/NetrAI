import os
import sys
import numpy as np
import pandas as pd
import xgboost as xgb
import pickle

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'health_forecast_xgb.pkl')

def generate_synthetic_data(num_samples=5000):
    np.random.seed(42)
    
    # current features
    # health_score: 0 to 100
    # traffic_volume: 500 to 15000
    # nearby_pois: 0 to 10
    
    health_score_t = np.random.uniform(20, 100, num_samples)
    traffic_volume = np.random.uniform(500, 15000, num_samples)
    nearby_pois = np.random.randint(0, 10, num_samples)
    
    # Calculate decay over 30 days
    # High traffic = faster decay
    # Low starting health = faster decay (compounding damage)
    # POIs = slightly faster decay (more local stops)
    
    decay_rate = (traffic_volume / 10000.0) * 5.0 + (100 - health_score_t) * 0.1 + (nearby_pois * 0.5)
    # Add random noise
    decay_rate += np.random.normal(0, 2, num_samples)
    
    health_score_t30 = np.clip(health_score_t - decay_rate, 0, 100)
    
    return pd.DataFrame({
        'health_score': health_score_t,
        'traffic_volume': traffic_volume,
        'nearby_pois': nearby_pois,
        'target_t30': health_score_t30
    })

def train_model():
    print("Generating synthetic data...")
    df = generate_synthetic_data()
    
    X = df[['health_score', 'traffic_volume', 'nearby_pois']]
    y = df['target_t30']
    
    print("Training XGBoost model...")
    model = xgb.XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1)
    model.fit(X, y)
    
    print(f"Saving model to {MODEL_PATH}...")
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print("Done!")

if __name__ == "__main__":
    train_model()
