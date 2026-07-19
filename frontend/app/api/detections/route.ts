import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db-indexes";

const DetectionSchema = z.object({
  type: z.enum(["road", "waste"]),
  imageUrl: z.string().url().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  detections: z.array(z.object({
    label: z.string().min(1).max(100),
    confidence: z.number().min(0).max(1),
    box: z.object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    }),
  })).max(1000),
});

export async function POST(req: NextRequest) {
  await ensureIndexes();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const parsed = DetectionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { type, imageUrl, width, height, detections } = parsed.data;
  const location: { lat: number; lng: number } | null = raw.location ?? null;

  const client = await clientPromise;
  const db = client.db("dammage");

  const result = await db.collection("detections").insertOne({
    userId,
    type,
    imageUrl,
    width,
    height,
    detections,
    location: location ?? null,
    createdAt: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
}

export async function GET(req: NextRequest) {
  await ensureIndexes();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "road" | "waste" | null;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const skip = parseInt(searchParams.get("skip") ?? "0", 10);

  const filter: Record<string, unknown> = { userId };
  if (type === "road" || type === "waste") {
    filter.type = type;
  }

  const client = await clientPromise;
  const db = client.db("dammage");
  const col = db.collection("detections");

  const [docs, total] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  const detections = docs.map(({ _id, ...rest }) => ({
    id: _id.toString(),
    ...rest,
  }));

  return NextResponse.json({ detections, total });
}
