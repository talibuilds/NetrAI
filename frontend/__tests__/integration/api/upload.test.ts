import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  uploadImage: vi.fn().mockResolvedValue("http://storage/bucket/result.jpg"),
}));

const makeFile = (name: string, type: string, sizeBytes: number) =>
  new File([new Uint8Array(sizeBytes)], name, { type });

const makeRequest = (file: File | null) => {
  const form = new FormData();
  if (file) form.append("file", file);
  return new NextRequest("http://localhost/api/upload", { method: "POST", body: form });
};

describe("POST /api/upload", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "user-123" } });
    const { uploadImage } = await import("@/lib/storage");
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValue("http://storage/bucket/result.jpg");
  });

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("img.jpg", "image/jpeg", 100)));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is included", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No file provided");
  });

  it("returns 415 for a PDF file", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("doc.pdf", "application/pdf", 1024)));
    expect(res.status).toBe(415);
  });

  it("returns 415 for a GIF file", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("anim.gif", "image/gif", 1024)));
    expect(res.status).toBe(415);
  });

  it("returns 413 when file exceeds 50 MB", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("big.jpg", "image/jpeg", 51 * 1024 * 1024)));
    expect(res.status).toBe(413);
  });

  it("returns 200 with url for valid jpeg", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("photo.jpg", "image/jpeg", 1024)));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("http://storage/bucket/result.jpg");
  });

  it("returns 200 for valid png", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("scan.png", "image/png", 1024)));
    expect(res.status).toBe(200);
  });

  it("returns 200 for valid webp", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("scan.webp", "image/webp", 1024)));
    expect(res.status).toBe(200);
  });

  it("accepts a file exactly at the 50 MB limit", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(makeRequest(makeFile("limit.jpg", "image/jpeg", 50 * 1024 * 1024)));
    expect(res.status).toBe(200);
  });
});
