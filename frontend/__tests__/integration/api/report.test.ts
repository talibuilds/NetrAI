import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";

const mockFindOne = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  default: Promise.resolve({
    db: vi.fn(() => ({
      collection: vi.fn(() => ({ findOne: mockFindOne })),
    })),
  }),
}));

const VALID_ID = new ObjectId().toHexString();

const makeRequest = (id: string) =>
  new NextRequest(`http://localhost/api/report/${id}`);

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleDoc = {
  _id: new ObjectId(VALID_ID),
  userId: "user-should-not-be-exposed",
  type: "waste",
  imageUrl: "http://storage/img.jpg",
  width: 800,
  height: 600,
  detections: [{ label: "garbage", confidence: 0.9, box: { x1: 0, y1: 0, x2: 50, y2: 50 } }],
  createdAt: new Date(),
};

describe("GET /api/report/[id] (public — no auth required)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindOne.mockReset();
  });

  it("returns a public report without authentication", async () => {
    mockFindOne.mockResolvedValue(sampleDoc);

    const { GET } = await import("@/app/api/report/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(VALID_ID);
    expect(body.type).toBe("waste");
    expect(body.imageUrl).toBe("http://storage/img.jpg");
    expect(body.detections).toHaveLength(1);
  });

  it("never exposes userId in the public response", async () => {
    mockFindOne.mockResolvedValue(sampleDoc);

    const { GET } = await import("@/app/api/report/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));
    const body = await res.json();

    expect(body.userId).toBeUndefined();
  });

  it("never exposes _id — only the string id field", async () => {
    mockFindOne.mockResolvedValue(sampleDoc);

    const { GET } = await import("@/app/api/report/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));
    const body = await res.json();

    expect(body._id).toBeUndefined();
    expect(body.id).toBe(VALID_ID);
  });

  it("returns 400 for a malformed id", async () => {
    const { GET } = await import("@/app/api/report/[id]/route");
    const res = await GET(makeRequest("not-valid"), makeParams("not-valid"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid id");
  });

  it("returns 404 when detection does not exist", async () => {
    mockFindOne.mockResolvedValue(null);

    const { GET } = await import("@/app/api/report/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("does not filter by userId — any detection is publicly accessible via its id", async () => {
    mockFindOne.mockResolvedValue(sampleDoc);

    const { GET } = await import("@/app/api/report/[id]/route");
    await GET(makeRequest(VALID_ID), makeParams(VALID_ID));

    // Public endpoint should NOT restrict by userId
    expect(mockFindOne).toHaveBeenCalledWith(
      expect.not.objectContaining({ userId: expect.anything() })
    );
  });
});
