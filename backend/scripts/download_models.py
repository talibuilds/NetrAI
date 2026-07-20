import os
import sys
from pathlib import Path

# Force cache directories to be inside the project root
BASE_DIR = Path(__file__).resolve().parent.parent
os.environ["TORCH_HOME"] = str(BASE_DIR / ".torch_cache")
os.environ["YOLO_CONFIG_DIR"] = str(BASE_DIR / ".yolo_config")
os.environ["MPLCONFIGDIR"] = str(BASE_DIR / ".mpl_config")

# Ensure they exist
for d in [os.environ["TORCH_HOME"], os.environ["YOLO_CONFIG_DIR"], os.environ["MPLCONFIGDIR"]]:
    Path(d).mkdir(parents=True, exist_ok=True)

print(f"Set TORCH_HOME to {os.environ['TORCH_HOME']}")

from ultralytics import YOLO

def main():
    print("Pre-downloading YOLOv8s-world.pt...")
    model = YOLO("yolov8s-world.pt")
    print("Pre-downloading CLIP prompts (triggers ViT-B/32 download)...")
    try:
        # Trigger CLIP download by setting text prompts
        model.set_classes(["trash", "garbage", "plastic"])
        print("Models successfully cached!")
    except Exception as e:
        print(f"Error caching models: {e}")

if __name__ == "__main__":
    main()
