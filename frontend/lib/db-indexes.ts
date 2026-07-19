import clientPromise from "@/lib/mongodb";

let indexed = false;

export async function ensureIndexes() {
  if (indexed) return;
  const client = await clientPromise;
  const col = client.db("dammage").collection("detections");
  await Promise.all([
    col.createIndex({ userId: 1, createdAt: -1 }),
    col.createIndex({ userId: 1, type: 1, createdAt: -1 }),
  ]);
  indexed = true;
}
