"""Cloudinary + MongoDB init and helpers."""
from __future__ import annotations

from datetime import datetime, timezone

import cloudinary
import cloudinary.uploader
from pymongo import MongoClient
from pymongo.database import Database

from .config import (
    ADMIN_SEED_EMAILS,
    ADMINS_COLL,
    CLOUDINARY_URL,
    MONGO_COLL,
    MONGO_DB,
    MONGO_URI,
)


def init_storage():
    """Initialize Cloudinary from the environment variable (CLOUDINARY_URL)."""
    if CLOUDINARY_URL:
        # cloudinary configures itself from the CLOUDINARY_URL env var automatically,
        # but we can explicitly call config to ensure it's picked up
        cloudinary.config()
        print("[cloudinary] initialized")
    else:
        print("[cloudinary] WARNING: CLOUDINARY_URL not set, uploads will fail")


def init_mongo() -> Database | None:
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        db = client[MONGO_DB]
        db[MONGO_COLL].create_index([("location", "2dsphere")])
        db[MONGO_COLL].create_index([("time", -1)])
        # Seed admins from env once. `_id` is the email so upsert is idempotent.
        if ADMIN_SEED_EMAILS:
            now = datetime.now(timezone.utc)
            for email in ADMIN_SEED_EMAILS:
                db[ADMINS_COLL].update_one(
                    {"_id": email},
                    {"$setOnInsert": {"added_at": now, "added_by": "seed", "name": None}},
                    upsert=True,
                )
        return db
    except Exception as e:
        print(f"[mongo] disabled — {type(e).__name__}: {e}")
        return None


def upload(key: str, data: bytes, content_type: str) -> str | None:
    if not CLOUDINARY_URL:
        return None
    try:
        # key usually contains slashes (e.g. reports/12.3,45.6/input.jpg).
        # Cloudinary uses public_id for this.
        public_id = key.rsplit('.', 1)[0] # remove extension for public_id
        
        result = cloudinary.uploader.upload(
            data,
            public_id=public_id,
            resource_type="image",
            overwrite=True
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"[cloudinary] upload failed: {e}")
        return None
