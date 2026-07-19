import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

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
  new NextRequest(`http://localhost/api/detections/${id}`);

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleDoc = {
  _id: new ObjectId(VALID_ID),
  userId: "user-123",
  type: "road",
  imageUrl: "http://storage/img.jpg",
  width: 1920,
  height: 1080,
  detections: [],
  createdAt: new Date(),
};

describe("GET /api/detections/[id]", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "user-123" } });
  });

  it("returns the detection for a valid id belonging to the user", async () => {
    mockFindOne.mockResolvedValue(sampleDoc);

    const { GET } = await import("@/app/api/detections/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(VALID_ID);
    expect(body.type).toBe("road");
    expect(body._id).toBeUndefined();
  });

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("@/app/api/detections/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed (non-ObjectId) id", async () => {
    const { GET } = await import("@/app/api/detections/[id]/route");
    const res = await GET(makeRequest("not-an-id"), makeParams("not-an-id"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid id");
  });

  it("returns 404 when detection does not exist", async () => {
    mockFindOne.mockResolvedValue(null);

    const { GET } = await import("@/app/api/detections/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("returns 404 when detection belongs to a different user", async () => {
    // MongoDB filters by userId — returns null when it doesn't match
    mockFindOne.mockResolvedValue(null);

    const { GET } = await import("@/app/api/detections/[id]/route");
    const res = await GET(makeRequest(VALID_ID), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("queries with both _id and userId to prevent cross-user access", async () => {
    mockFindOne.mockResolvedValue(sampleDoc);

    const { GET } = await import("@/app/api/detections/[id]/route");
    await GET(makeRequest(VALID_ID), makeParams(VALID_ID));

    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-123" })
    );
  });
});
