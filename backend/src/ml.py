"""Model loading, inference, severity scoring, and annotation drawing.

Waste → YOLOv8n via ONNX Runtime (no torch, ~30 MB RAM).
Road  → TFLite int8 pothole detector via ai_edge_litert.

Total runtime memory: ~150 MB (vs ~400 MB with torch+ultralytics).
"""
from __future__ import annotations

import io
import math
import os
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .config import (
    CATEGORY_COLORS,
    CATEGORY_META,
    HEURISTIC_KEYWORDS,
    ROAD_CONF,
    ROAD_IMGSZ,
    ROAD_LABEL,
    ROAD_MAX_DET,
    ROAD_TFLITE,
    WASTE_CONF,
    WASTE_FULL_IMGSZ,
    WASTE_MAX_DET,
    WASTE_MAX_IMAGE_DIM,
    WASTE_MERGE_IOU,
    WASTE_MODEL,
)


# ─────────────────── ONNX Runtime Waste Model ─────────────────── #

class OnnxWasteModel:
    """YOLOv8n loaded via ONNX Runtime — no torch needed."""

    # Standard COCO classes that correspond to urban waste/litter
    COCO_WASTE_IDS = {39, 40, 41, 42, 43, 44, 45, 73, 75}
    # 39=bottle 40=wine glass 41=cup 42=fork 43=knife 44=spoon 45=bowl 73=book 75=vase

    COCO_NAMES = {
        0: 'person', 1: 'bicycle', 2: 'car', 3: 'motorcycle', 4: 'airplane',
        5: 'bus', 6: 'train', 7: 'truck', 8: 'boat', 9: 'traffic light',
        10: 'fire hydrant', 11: 'stop sign', 12: 'parking meter', 13: 'bench',
        14: 'bird', 15: 'cat', 16: 'dog', 17: 'horse', 18: 'sheep', 19: 'cow',
        20: 'elephant', 21: 'bear', 22: 'zebra', 23: 'giraffe', 24: 'backpack',
        25: 'umbrella', 26: 'handbag', 27: 'tie', 28: 'suitcase', 29: 'frisbee',
        30: 'skis', 31: 'snowboard', 32: 'sports ball', 33: 'kite',
        34: 'baseball bat', 35: 'baseball glove', 36: 'skateboard', 37: 'surfboard',
        38: 'tennis racket', 39: 'bottle', 40: 'wine glass', 41: 'cup',
        42: 'fork', 43: 'knife', 44: 'spoon', 45: 'bowl', 46: 'banana',
        47: 'apple', 48: 'sandwich', 49: 'orange', 50: 'broccoli', 51: 'carrot',
        52: 'hot dog', 53: 'pizza', 54: 'donut', 55: 'cake', 56: 'chair',
        57: 'couch', 58: 'potted plant', 59: 'bed', 60: 'dining table',
        61: 'toilet', 62: 'tv', 63: 'laptop', 64: 'mouse', 65: 'remote',
        66: 'keyboard', 67: 'cell phone', 68: 'microwave', 69: 'oven',
        70: 'toaster', 71: 'sink', 72: 'refrigerator', 73: 'book',
        74: 'clock', 75: 'vase', 76: 'scissors', 77: 'teddy bear',
        78: 'hair drier', 79: 'toothbrush',
    }

    def __init__(self, onnx_path: str):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 2
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(onnx_path, opts, providers=["CPUExecutionProvider"])
        meta = self.session.get_inputs()[0]
        self.input_name = meta.name
        self.input_shape = meta.shape  # [1, 3, H, W]
        print(f"[model] ONNX waste ready: {Path(onnx_path).name}  input={self.input_shape}")

    def _preprocess(self, img: Image.Image, imgsz: int) -> tuple[np.ndarray, float, float, float]:
        """Letterbox + normalise to [1, 3, imgsz, imgsz] float32."""
        iw, ih = img.size
        scale = min(imgsz / iw, imgsz / ih)
        nw, nh = int(iw * scale), int(ih * scale)
        resized = img.resize((nw, nh), Image.BILINEAR)
        canvas = Image.new("RGB", (imgsz, imgsz), (114, 114, 114))
        pad_x, pad_y = (imgsz - nw) // 2, (imgsz - nh) // 2
        canvas.paste(resized, (pad_x, pad_y))
        arr = np.asarray(canvas, dtype=np.float32) / 255.0  # HWC
        arr = arr.transpose(2, 0, 1)[np.newaxis]  # 1CHW
        return arr, scale, pad_x, pad_y

    def predict(self, img: Image.Image, conf: float, imgsz: int, max_det: int) -> list[dict]:
        blob, scale, px, py = self._preprocess(img, imgsz)
        outputs = self.session.run(None, {self.input_name: blob})
        # YOLOv8 ONNX output shape: [1, 84, 8400] → transpose to [8400, 84]
        preds = outputs[0][0].T  # (8400, 84)
        boxes_xywh = preds[:, :4]
        scores = preds[:, 4:]
        cls_ids = scores.argmax(axis=1)
        confs = scores[np.arange(len(scores)), cls_ids]

        # Filter by confidence
        mask = confs >= conf
        boxes_xywh = boxes_xywh[mask]
        cls_ids = cls_ids[mask]
        confs = confs[mask]

        if len(confs) == 0:
            return []

        # Convert xywh → xyxy
        x_c, y_c, w, h = boxes_xywh[:, 0], boxes_xywh[:, 1], boxes_xywh[:, 2], boxes_xywh[:, 3]
        x1 = x_c - w / 2
        y1 = y_c - h / 2
        x2 = x_c + w / 2
        y2 = y_c + h / 2

        # Undo letterbox padding
        x1 = (x1 - px) / scale
        y1 = (y1 - py) / scale
        x2 = (x2 - px) / scale
        y2 = (y2 - py) / scale

        # NMS
        boxes_for_nms = np.stack([x1, y1, x2, y2], axis=1).astype(np.float32)
        indices = self._nms(boxes_for_nms, confs, iou_thresh=0.45)
        indices = indices[:max_det]

        results = []
        for i in indices:
            cid = int(cls_ids[i])
            # Only keep waste-related COCO classes
            if cid not in self.COCO_WASTE_IDS:
                continue
            results.append({
                "xyxy": [float(x1[i]), float(y1[i]), float(x2[i]), float(y2[i])],
                "conf": float(confs[i]),
                "raw": self.COCO_NAMES.get(cid, str(cid)),
                "polygon": None,
            })
        return results

    @staticmethod
    def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> list[int]:
        """Simple greedy NMS."""
        order = scores.argsort()[::-1]
        keep = []
        x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        suppressed = np.zeros(len(scores), dtype=bool)
        for idx in order:
            if suppressed[idx]:
                continue
            keep.append(int(idx))
            ix1 = np.maximum(x1[idx], x1)
            iy1 = np.maximum(y1[idx], y1)
            ix2 = np.minimum(x2[idx], x2)
            iy2 = np.minimum(y2[idx], y2)
            inter = np.maximum(0, ix2 - ix1) * np.maximum(0, iy2 - iy1)
            iou = inter / (areas[idx] + areas - inter + 1e-9)
            suppressed |= iou > iou_thresh
            suppressed[idx] = False  # don't suppress self
        return keep


# ─────────────────── TFLite Road Model ─────────────────── #

class TfliteRoadModel:
    """TFLite int8 pothole detector via ai_edge_litert."""

    def __init__(self, tflite_path: str):
        from ai_edge_litert.interpreter import Interpreter
        self.interp = Interpreter(model_path=tflite_path, num_threads=4)
        self.interp.allocate_tensors()
        inp = self.interp.get_input_details()[0]
        out = self.interp.get_output_details()
        self.input_idx = inp["index"]
        self.input_shape = inp["shape"]  # e.g. [1, 320, 320, 3]
        self.input_dtype = inp["dtype"]
        self.output_details = out

        # Quantization params
        self.input_scale = inp.get("quantization_parameters", {}).get("scales", [1.0])
        self.input_zp = inp.get("quantization_parameters", {}).get("zero_points", [0])
        if hasattr(self.input_scale, '__len__') and len(self.input_scale) > 0:
            self.input_scale = float(self.input_scale[0])
        else:
            self.input_scale = 1.0
        if hasattr(self.input_zp, '__len__') and len(self.input_zp) > 0:
            self.input_zp = int(self.input_zp[0])
        else:
            self.input_zp = 0

        print(f"[model] TFLite road ready: {Path(tflite_path).name}  "
              f"input={list(self.input_shape)} dtype={self.input_dtype.__name__}")

    def predict(self, img: Image.Image, conf: float, max_det: int) -> list[dict]:
        h, w = int(self.input_shape[1]), int(self.input_shape[2])
        orig_w, orig_h = img.size

        # Letterbox resize
        scale = min(w / orig_w, h / orig_h)
        nw, nh = int(orig_w * scale), int(orig_h * scale)
        resized = img.resize((nw, nh), Image.BILINEAR)
        canvas = Image.new("RGB", (w, h), (114, 114, 114))
        px, py = (w - nw) // 2, (h - nh) // 2
        canvas.paste(resized, (px, py))

        arr = np.asarray(canvas, dtype=np.float32) / 255.0

        # Quantize if int8
        if self.input_dtype == np.int8:
            arr = (arr / self.input_scale + self.input_zp).clip(-128, 127).astype(np.int8)
        elif self.input_dtype == np.uint8:
            arr = (arr / self.input_scale + self.input_zp).clip(0, 255).astype(np.uint8)

        arr = arr[np.newaxis]  # [1, H, W, 3]
        print("Invoking TFLite...")
        self.interp.set_tensor(self.input_idx, arr)
        self.interp.invoke()
        print("TFLite invoke done")

        # Read output — YOLOv8 TFLite output: [1, num_classes+4, num_boxes]
        raw_out = self.interp.get_tensor(self.output_details[0]["index"])

        # Dequantize if needed
        out_params = self.output_details[0].get("quantization_parameters", {})
        out_scale = out_params.get("scales", [1.0])
        out_zp = out_params.get("zero_points", [0])
        if hasattr(out_scale, '__len__') and len(out_scale) > 0:
            out_scale = float(out_scale[0])
        else:
            out_scale = 1.0
        if hasattr(out_zp, '__len__') and len(out_zp) > 0:
            out_zp = int(out_zp[0])
        else:
            out_zp = 0

        if raw_out.dtype != np.float32:
            raw_out = (raw_out.astype(np.float32) - out_zp) * out_scale

        preds = raw_out[0]  # [num_classes+4, num_boxes]
        # Could be [num_boxes, num_classes+4] — detect orientation
        if preds.shape[0] > preds.shape[1]:
            preds = preds.T  # now [num_classes+4, num_boxes]

        # Transpose to [num_boxes, num_classes+4]
        preds = preds.T

        boxes_xywh = preds[:, :4]
        scores = preds[:, 4:]

        if scores.ndim == 1:
            confs = scores
            cls_ids = np.zeros(len(scores), dtype=int)
        else:
            cls_ids = scores.argmax(axis=1)
            confs = scores[np.arange(len(scores)), cls_ids]

        mask = confs >= conf
        boxes_xywh = boxes_xywh[mask]
        confs = confs[mask]

        if len(confs) == 0:
            return []

        x_c, y_c, bw, bh = boxes_xywh[:, 0], boxes_xywh[:, 1], boxes_xywh[:, 2], boxes_xywh[:, 3]
        x1 = (x_c - bw / 2 - px) / scale
        y1 = (y_c - bh / 2 - py) / scale
        x2 = (x_c + bw / 2 - px) / scale
        y2 = (y_c + bh / 2 - py) / scale

        # Clip to image bounds
        x1 = np.clip(x1, 0, orig_w)
        y1 = np.clip(y1, 0, orig_h)
        x2 = np.clip(x2, 0, orig_w)
        y2 = np.clip(y2, 0, orig_h)

        # NMS
        boxes_for_nms = np.stack([x1, y1, x2, y2], axis=1).astype(np.float32)
        areas = (x2 - x1) * (y2 - y1)
        order = confs.argsort()[::-1]
        keep = []
        suppressed = np.zeros(len(confs), dtype=bool)
        for idx in order:
            if suppressed[idx]:
                continue
            keep.append(int(idx))
            if len(keep) >= max_det:
                break
            ix1 = np.maximum(x1[idx], x1)
            iy1 = np.maximum(y1[idx], y1)
            ix2 = np.minimum(x2[idx], x2)
            iy2 = np.minimum(y2[idx], y2)
            inter = np.maximum(0, ix2 - ix1) * np.maximum(0, iy2 - iy1)
            iou = inter / (areas[idx] + areas - inter + 1e-9)
            suppressed |= iou > 0.45
            suppressed[idx] = False

        results = []
        for i in keep:
            results.append({
                "label": ROAD_LABEL,
                "confidence": float(confs[i]),
                "box": {"x1": int(x1[i]), "y1": int(y1[i]), "x2": int(x2[i]), "y2": int(y2[i])},
            })
        return results


# ───────────────────────── Model loading ───────────────────────── #

def load_waste() -> OnnxWasteModel | None:
    """Load YOLOv8n ONNX model."""
    onnx_path = Path(WASTE_MODEL)
    if not onnx_path.exists():
        print(f"[model] waste ONNX missing → {onnx_path}")
        return None
    try:
        return OnnxWasteModel(str(onnx_path))
    except Exception as e:
        print(f"[model] waste load failed: {type(e).__name__}: {e}")
        return None


def load_road() -> TfliteRoadModel | None:
    """Load TFLite road detector."""
    path = Path(ROAD_TFLITE)
    if not path.exists():
        print(f"[model] road tflite missing → {path.name}")
        return None
    try:
        return TfliteRoadModel(str(path))
    except Exception as e:
        print(f"[model] road load failed: {type(e).__name__}: {e}")
        return None


# ───────────────────────── Generic helpers ───────────────────────── #

def _iou_xyxy(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1) + max(0.0, bx2 - bx1) * max(0.0, by2 - by1) - inter
    return inter / union if union > 0 else 0.0


def _resolve_category(raw_label: str) -> tuple[str, dict]:
    low = raw_label.lower()
    for kw, canon in HEURISTIC_KEYWORDS:
        if kw in low:
            return canon, CATEGORY_META[canon]
    return "mixed", CATEGORY_META["mixed"]


def _position_weight(cx: float, cy: float, w: int, h: int) -> float:
    dx, dy = (cx - w / 2) / (w / 2), (cy - h / 2) / (h / 2)
    return max(0.0, 1.0 - (dx * dx + dy * dy) ** 0.5)


def _waste_severity(area_pct: float, conf: float, meta: dict, pw: float) -> float:
    base = min(area_pct * 3.0, 60.0)
    return round(min(base * (0.5 + 0.5 * meta["pollution"]) * conf * (0.85 + 0.15 * pw), 100.0), 2)


def _waste_impact(area_pct: float, meta: dict) -> float:
    decomp_norm = min(math.log1p(meta["decomp_years"]) / math.log1p(1_000_000), 1.0)
    score = (0.4 * meta["pollution"] + 0.3 * meta["hazard"] + 0.3 * decomp_norm) * 100
    return round(score * (0.5 + 0.5 * min(area_pct / 20.0, 1.0)), 2)


def _road_severity(detections: list, img_area: float) -> float:
    if not detections:
        return 0.0
    total_area = sum(
        max(0.0, d["box"]["x2"] - d["box"]["x1"]) * max(0.0, d["box"]["y2"] - d["box"]["y1"])
        for d in detections
    )
    area_pct = (total_area / img_area) * 100.0
    avg_conf = sum(d["confidence"] for d in detections) / len(detections)
    base = min(len(detections) * 12.0, 60.0)
    return round(min((base + area_pct * 2.0) * (0.7 + 0.3 * avg_conf), 100.0), 2)


# ───────────────────── Road pipeline ───────────────────── #

def run_road(model: TfliteRoadModel | None, img: Image.Image) -> tuple[list, float]:
    if model is None:
        return [], 0.0
    W, H = img.size
    detections = model.predict(img, conf=ROAD_CONF, max_det=ROAD_MAX_DET)
    return detections, _road_severity(detections, float(W * H))


# ───────────────────── Waste pipeline ───────────────────── #

def _maybe_resize(img: Image.Image) -> Image.Image:
    if max(img.size) <= WASTE_MAX_IMAGE_DIM:
        return img
    s = WASTE_MAX_IMAGE_DIM / max(img.size)
    return img.resize((int(img.size[0] * s), int(img.size[1] * s)), Image.LANCZOS)


def run_waste(model: OnnxWasteModel | None, img: Image.Image) -> tuple[list, dict, float, float]:
    empty_stats = {"total_detections": 0, "total_coverage_pct": 0.0, "class_counts": {}, "category_counts": {}}
    if model is None:
        return [], empty_stats, 0.0, 0.0

    img = _maybe_resize(img)
    W, H = img.size
    img_area = float(W * H)

    # Single pass — no tiling (saves RAM)
    raw = model.predict(img, conf=WASTE_CONF, imgsz=WASTE_FULL_IMGSZ, max_det=WASTE_MAX_DET)

    # Deduplicate
    if raw:
        for r in raw:
            r["_canon"] = _resolve_category(r["raw"])[0]
        raw.sort(key=lambda d: -d["conf"])
        kept: list = []
        for d in raw:
            if not any(k["_canon"] == d["_canon"] and _iou_xyxy(d["xyxy"], k["xyxy"]) > WASTE_MERGE_IOU for k in kept):
                kept.append(d)
        raw = kept

    detections: list = []
    for r in raw:
        x1, y1, x2, y2 = r["xyxy"]
        area_pct = ((x2 - x1) * (y2 - y1)) / img_area * 100.0
        cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
        category, meta = _resolve_category(r["raw"])
        pw = _position_weight(cx, cy, W, H)
        detections.append({
            "label": r["raw"],
            "category": category,
            "confidence": round(r["conf"], 4),
            "box": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
            "centroid": [round(cx, 1), round(cy, 1)],
            "area_pct": round(area_pct, 2),
            "severity": _waste_severity(area_pct, r["conf"], meta, pw),
            "environmental_impact": _waste_impact(area_pct, meta),
            "recyclable": meta["recyclable"],
            "decomp_years": meta["decomp_years"],
            "_polygon": None,
        })

    if detections:
        total_coverage = round(sum(d["area_pct"] for d in detections), 2)
        avg_sev = sum(d["severity"] for d in detections) / len(detections)
        sev_score = round(min(avg_sev * (1.0 + total_coverage / 100.0), 100.0), 2)
        imp_score = round(sum(d["environmental_impact"] for d in detections) / len(detections), 2)
    else:
        total_coverage, sev_score, imp_score = 0.0, 0.0, 0.0

    stats = {
        "total_detections": len(detections),
        "total_coverage_pct": total_coverage,
        "class_counts": dict(Counter(d["label"] for d in detections)),
        "category_counts": dict(Counter(d["category"] for d in detections)),
    }
    return detections, stats, sev_score, imp_score


# ───────────────────────── Annotation ───────────────────────── #

def _load_font(size: int):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def annotate(img: Image.Image, waste_dets: list, road_dets: list, waste_sev: float, road_sev: float) -> bytes:
    base = img.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    W, _ = base.size
    f_lg = _load_font(max(20, W // 50))
    f_md = _load_font(max(15, W // 70))
    f_sm = _load_font(max(12, W // 90))

    merged = [{**d, "category": d.get("category", "mixed")} for d in waste_dets] + \
             [{**d, "category": "road"} for d in road_dets]

    for d in merged:
        color = CATEGORY_COLORS.get(d["category"], (156, 163, 175))
        b = d["box"]
        draw.rectangle((b["x1"], b["y1"], b["x2"], b["y2"]), outline=(*color, 255), width=3)
        lbl = f"{d['label']} {d['confidence']*100:.0f}%"
        tb = draw.textbbox((b["x1"], b["y1"]), lbl, font=f_sm)
        pad = 4
        draw.rectangle((tb[0] - pad, tb[1] - pad, tb[2] + pad, tb[3] + pad), fill=(*color, 220))
        draw.text((b["x1"], b["y1"]), lbl, fill=(255, 255, 255, 255), font=f_sm)

    lines = [
        (f"trash {len(waste_dets)} · pothole {len(road_dets)}", f_lg),
        (f"waste severity {waste_sev:.1f}", f_md),
        (f"road severity {road_sev:.1f}", f_md),
    ]
    y = 20
    for text, font in lines:
        draw.text((22, y + 2), text, fill=(0, 0, 0, 200), font=font)
        draw.text((20, y), text, fill=(255, 255, 255, 255), font=font)
        y += font.getbbox(text)[3] + 10

    out = Image.alpha_composite(base, overlay).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=85)
    return buf.getvalue()
