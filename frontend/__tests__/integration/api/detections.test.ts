import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db-indexes", () => ({ ensureIndexes: vi.fn().mockResolvedValue(undefined) }));

const mockInsertOne = vi.fn();
const mockToArray = vi.fn();
const mockCountDocuments = vi.fn();
const mockFind = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  default: Promise.resolve({
    db: vi.fn(() => ({
      collection: vi.fn(() => ({
        insertOne: mockInsertOne,
        find: mockFind,
        countDocuments: mockCountDocuments,
      })),
    })),
  }),
}));

const post = (body: object) =>
  new NextRequest("http://localhost/api/detections", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const get = (qs = "") =>
  new NextRequest(`http://localhost/api/detections${qs}`);

const validPayload = {
  type: "road",
  imageUrl: "http://storage/img.jpg",
  width: 1920,
  height: 1080,
  detections: [
    { label: "pothole", confidence: 0.95, box: { x1: 10, y1: 20, x2: 100, y2: 200 } },
  ],
};

describe("POST /api/detections", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockInsertOne.mockReset();
    mockInsertOne.mockResolvedValue({ insertedId: { toString: () => "det-001" } });
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "user-123" } });
  });

  it("saves detection and returns 201 with id", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post(validPayload));
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe("det-001");
  });

  it("returns 401 when session is missing", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post(validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid detection type", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, type: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero width", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, width: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative height", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, height: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when confidence is above 1.0", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(
      post({
        ...validPayload,
        detections: [{ label: "x", confidence: 1.5, box: { x1: 0, y1: 0, x2: 1, y2: 1 } }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when confidence is below 0", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(
      post({
        ...validPayload,
        detections: [{ label: "x", confidence: -0.1, box: { x1: 0, y1: 0, x2: 1, y2: 1 } }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts null imageUrl", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, imageUrl: null }));
    expect(res.status).toBe(201);
  });

  it("accepts waste as detection type", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, type: "waste" }));
    expect(res.status).toBe(201);
  });

  it("accepts optional location field", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, location: { lat: 40.7128, lng: -74.006 } }));
    expect(res.status).toBe(201);
  });

  it("accepts empty detections array", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const res = await POST(post({ ...validPayload, detections: [] }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when detections array exceeds 1000 items", async () => {
    const { POST } = await import("@/app/api/detections/route");
    const tooMany = Array.from({ length: 1001 }, (_, i) => ({
      label: `label-${i}`,
      confidence: 0.5,
      box: { x1: 0, y1: 0, x2: 1, y2: 1 },
    }));
    const res = await POST(post({ ...validPayload, detections: tooMany }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/detections", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFind.mockReset();
    mockCountDocuments.mockReset();
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "user-123" } });
  });

  const seedMocks = (docs: object[], total: number) => {
    mockFind.mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ toArray: async () => docs }) }) }),
    });
    mockCountDocuments.mockResolvedValue(total);
  };

  it("returns list of detections with total count", async () => {
    seedMocks(
      [{ _id: { toString: () => "det-001" }, type: "road", createdAt: new Date() }],
      1
    );

    const { GET } = await import("@/app/api/detections/route");
    const res = await GET(get());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.detections).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.detections[0].id).toBe("det-001");
    expect(body.detections[0]._id).toBeUndefined();
  });

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("@/app/api/detections/route");
    const res = await GET(get());
    expect(res.status).toBe(401);
  });

  it("returns empty list when no detections exist", async () => {
    seedMocks([], 0);

    const { GET } = await import("@/app/api/detections/route");
    const res = await GET(get());
    const body = await res.json();
    expect(body.detections).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("applies type filter when query param is provided", async () => {
    seedMocks([], 0);

    const { GET } = await import("@/app/api/detections/route");
    await GET(get("?type=road"));
    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ type: "road" }));
  });

  it("ignores unknown type query param (no type filter applied)", async () => {
    seedMocks([], 0);

    const { GET } = await import("@/app/api/detections/route");
    await GET(get("?type=unknown"));
    expect(mockFind).toHaveBeenCalledWith(expect.not.objectContaining({ type: "unknown" }));
  });
});
