import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPutObject = vi.fn().mockResolvedValue(undefined);

vi.mock("minio", () => ({
  Client: vi.fn().mockImplementation(() => ({ putObject: mockPutObject })),
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return { ...actual, randomUUID: vi.fn().mockReturnValue("test-uuid-fixed") };
});

describe("uploadImage", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPutObject.mockClear();
  });

  it("returns an http URL with correct bucket and key", async () => {
    const { uploadImage } = await import("@/lib/storage");
    const url = await uploadImage(Buffer.from("data"), "photo.jpg", "image/jpeg");
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:9000\/test-bucket\//);
    expect(url).toContain("test-uuid-fixed");
    expect(url).toEndWith(".jpg");
  });

  it("uses the correct file extension from the filename", async () => {
    const { uploadImage } = await import("@/lib/storage");
    const pngUrl = await uploadImage(Buffer.from("data"), "scan.png", "image/png");
    expect(pngUrl).toEndWith(".png");

    const webpUrl = await uploadImage(Buffer.from("data"), "scan.webp", "image/webp");
    expect(webpUrl).toEndWith(".webp");
  });

  it("falls back to jpg when filename has no extension", async () => {
    const { uploadImage } = await import("@/lib/storage");
    const url = await uploadImage(Buffer.from("data"), "noextension", "image/jpeg");
    expect(url).toEndWith(".jpg");
  });

  it("calls putObject with the correct bucket, key, and content type", async () => {
    const { uploadImage } = await import("@/lib/storage");
    const buf = Buffer.from("image-bytes");
    await uploadImage(buf, "test.png", "image/png");

    expect(mockPutObject).toHaveBeenCalledOnce();
    const [bucket, key, , , meta] = mockPutObject.mock.calls[0];
    expect(bucket).toBe("test-bucket");
    expect(key).toEndWith(".png");
    expect(meta).toEqual({ "Content-Type": "image/png" });
  });

  it("uses https when MINIO_USE_SSL is true", async () => {
    vi.stubEnv("MINIO_USE_SSL", "true");
    vi.resetModules();
    const { uploadImage } = await import("@/lib/storage");
    const url = await uploadImage(Buffer.from("data"), "img.jpg", "image/jpeg");
    expect(url).toStartWith("https://");
    vi.unstubAllEnvs();
  });
});
