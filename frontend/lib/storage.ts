import { Client } from "minio";
import { randomUUID } from "crypto";

const BUCKET = process.env.MINIO_BUCKET ?? "dammage";
const ENDPOINT = process.env.MINIO_ENDPOINT ?? "127.0.0.1";
const PORT = parseInt(process.env.MINIO_PORT ?? "9000", 10);
const USE_SSL = process.env.MINIO_USE_SSL === "true";

const client = new Client({
  endPoint: ENDPOINT,
  port: PORT,
  useSSL: USE_SSL,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

export async function uploadImage(
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
): Promise<string> {
  const ext = originalFilename.split(".").pop() ?? "jpg";
  const key = `${Date.now()}-${randomUUID()}.${ext}`;
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  const protocol = USE_SSL ? "https" : "http";
  return `${protocol}://${ENDPOINT}:${PORT}/${BUCKET}/${key}`;
}

export default client;
