FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libglib2.0-0 libgl1 libsm6 libxrender1 libxext6 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

# Dependencies first — cache layer
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ultralytics's TFLite backend imports `tflite_runtime`, but upstream doesn't
# publish wheels for Python 3.12. Alias to ai-edge-litert (already in deps).
RUN /app/.venv/bin/python - <<'PY'
import os, site
p = site.getsitepackages()[0]
os.makedirs(f"{p}/tflite_runtime", exist_ok=True)
with open(f"{p}/tflite_runtime/__init__.py", "w") as f:
    f.write("from ai_edge_litert import __version__\n")
with open(f"{p}/tflite_runtime/interpreter.py", "w") as f:
    f.write("from ai_edge_litert.interpreter import Interpreter, load_delegate\n")
PY

# Copy models (small: 12 MB ONNX + 11 MB TFLite)
COPY yolov8n.onnx ./
COPY best_int8.tflite ./

# Verify ONNX loads
RUN /app/.venv/bin/python -c "import onnxruntime; print('onnxruntime', onnxruntime.__version__)"

COPY src ./src

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
