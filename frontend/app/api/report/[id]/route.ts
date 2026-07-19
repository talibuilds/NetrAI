import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db("dammage");

  const doc = await db.collection("detections").findOne({ _id: objectId });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: doc._id.toString(),
    type: doc.type,
    imageUrl: doc.imageUrl ?? null,
    width: doc.width,
    height: doc.height,
    detections: doc.detections,
    createdAt: doc.createdAt,
  });
}
