#!/usr/bin/env node
/**
 * DAMMAGE seed script
 * Usage: node scripts/seed.mjs [--reset]
 *   --reset  wipe users + detections before seeding
 *
 * Requires MongoDB running at MONGODB_URI (reads .env.local automatically).
 */

import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

try {
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("⚠️  Could not read .env.local — using existing env vars");
}

const MONGO_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/dammage";
const DB_NAME = "dammage";
const RESET = process.argv.includes("--reset");

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const USERS = [
  {
    name: "Admin",
    email: "admin@dammage.io",
    password: "Admin@123456",
    role: "admin",
    image: null,
  },
  {
    name: "Alex Inspector",
    email: "inspector@city.gov",
    password: "Password123",
    role: "user",
    image: null,
  },
  {
    name: "Sam Drone",
    email: "drone@operator.com",
    password: "Password123",
    role: "user",
    image: null,
  },
  {
    name: "Jordan Citizen",
    email: "citizen@example.com",
    password: "Password123",
    role: "user",
    image: null,
  },
];

const ROAD_LABELS = ["pothole", "crack", "alligator crack", "patch", "surface wear"];
const WASTE_LABELS = ["garbage pile", "plastic bottle", "cardboard box", "metal can", "organic waste", "mixed litter"];

// City locations for variety
const LOCATIONS = [
  { lat: 40.7128, lng: -74.006 },   // New York
  { lat: 48.8566, lng: 2.3522 },    // Paris
  { lat: 51.5074, lng: -0.1278 },   // London
  { lat: 35.6762, lng: 139.6503 },  // Tokyo
  { lat: -33.8688, lng: 151.2093 }, // Sydney
  { lat: 55.7558, lng: 37.6173 },   // Moscow
  null,
  null, // Some without location
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 4) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(loc, delta = 0.05) {
  if (!loc) return null;
  return {
    lat: parseFloat((loc.lat + randFloat(-delta, delta)).toFixed(6)),
    lng: parseFloat((loc.lng + randFloat(-delta, delta)).toFixed(6)),
  };
}

function makeDetections(type) {
  const labels = type === "road" ? ROAD_LABELS : WASTE_LABELS;
  const count = randInt(1, 5);
  return Array.from({ length: count }, () => {
    const x1 = randInt(10, 400);
    const y1 = randInt(10, 300);
    return {
      label: randFrom(labels),
      confidence: randFloat(0.45, 0.99, 2),
      box: {
        x1,
        y1,
        x2: x1 + randInt(40, 200),
        y2: y1 + randInt(30, 150),
      },
    };
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(6, 22), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const client = new MongoClient(MONGO_URI);

try {
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`✅ Connected to MongoDB: ${MONGO_URI}`);

  if (RESET) {
    await db.collection("users").deleteMany({});
    await db.collection("detections").deleteMany({});
    // Auth.js adapter collections
    await db.collection("accounts").deleteMany({});
    await db.collection("sessions").deleteMany({});
    console.log("🗑️  Wiped users, detections, accounts, sessions");
  }

  // -------------------------------------------------------------------------
  // Seed users
  // -------------------------------------------------------------------------
  const createdUsers = [];

  for (const u of USERS) {
    const existing = await db.collection("users").findOne({ email: u.email });
    if (existing) {
      console.log(`⏭️  User already exists: ${u.email}`);
      createdUsers.push({ ...u, _id: existing._id });
      continue;
    }

    const hash = await bcrypt.hash(u.password, 12);
    const doc = {
      _id: new ObjectId(),
      name: u.name,
      email: u.email,
      emailVerified: null,
      image: u.image,
      password: hash,
      ...(u.role === "admin" ? { role: "admin" } : {}),
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(doc);
    createdUsers.push({ ...u, _id: doc._id });
    console.log(`👤 Created user: ${u.email} (${u.role}) / ${u.password}`);
  }

  // -------------------------------------------------------------------------
  // Seed detections  (~8 per regular user, ~3 per user spread over 14 days)
  // -------------------------------------------------------------------------
  const baseLocation = randFrom(LOCATIONS.filter(Boolean));
  let totalDetections = 0;

  for (const user of createdUsers) {
    const count = user.role === "admin" ? 3 : randInt(6, 12);
    const docs = [];

    for (let i = 0; i < count; i++) {
      const type = Math.random() > 0.5 ? "road" : "waste";
      const location = jitter(Math.random() > 0.3 ? baseLocation : randFrom(LOCATIONS));
      docs.push({
        _id: new ObjectId(),
        userId: user._id.toString(),
        type,
        imageUrl: null,
        width: 1280,
        height: 720,
        detections: makeDetections(type),
        location,
        createdAt: daysAgo(randInt(0, 13)),
      });
    }

    await db.collection("detections").insertMany(docs);
    totalDetections += docs.length;
    console.log(`📍 Seeded ${docs.length} detections for ${user.email}`);
  }

  // -------------------------------------------------------------------------
  // Ensure indexes
  // -------------------------------------------------------------------------
  const col = db.collection("detections");
  await Promise.all([
    col.createIndex({ userId: 1, createdAt: -1 }),
    col.createIndex({ userId: 1, type: 1, createdAt: -1 }),
  ]);
  console.log("📇 Indexes ensured on detections");

  console.log(`\n✅ Seed complete — ${createdUsers.length} users, ${totalDetections} detections\n`);
  console.log("Accounts:");
  for (const u of USERS) {
    console.log(`  ${u.role === "admin" ? "🔑" : "👤"} ${u.email}  /  ${u.password}`);
  }
  console.log();
} finally {
  await client.close();
}
