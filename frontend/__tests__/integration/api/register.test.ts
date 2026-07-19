import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be declared before any imports that trigger them
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashed"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

const mockFindOne = vi.fn();
const mockInsertOne = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  default: Promise.resolve({
    db: vi.fn(() => ({
      collection: vi.fn(() => ({
        findOne: mockFindOne,
        insertOne: mockInsertOne,
      })),
    })),
  }),
}));

const makeRequest = (body: object, ip = "1.2.3.4") =>
  new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockInsertOne.mockReset();
  });

  it("creates a user and returns 201 with id, email, name", async () => {
    mockFindOne.mockResolvedValue(null);
    mockInsertOne.mockResolvedValue({ insertedId: { toString: () => "abc123" } });

    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Ada", email: "ada@test.com", password: "Secret123!" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("ada@test.com");
    expect(body.name).toBe("Ada");
    expect(body.id).toBe("abc123");
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ email: "ada@test.com", password: "Secret123!" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Ada", password: "Secret123!" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Ada", email: "ada@test.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Ada", email: "ada@test.com", password: "Abc1!" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("8 characters");
  });

  it("returns 400 when password has no number or special character", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Ada", email: "ada@test.com", password: "alllowercase" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("number or special character");
  });

  it("returns 409 when email already exists (without leaking 'already registered')", async () => {
    mockFindOne.mockResolvedValue({ email: "ada@test.com" });

    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Ada", email: "ada@test.com", password: "Secret123!" }));

    expect(res.status).toBe(409);
    const body = await res.json();
    // Must NOT say "already registered" — that leaks user enumeration
    expect(body.error).toBe("Registration failed");
    expect(body.error).not.toContain("already");
  });

  it("returns 429 after 5 registration attempts from the same IP", async () => {
    mockFindOne.mockResolvedValue(null);
    mockInsertOne.mockResolvedValue({ insertedId: { toString: () => "x" } });

    const { POST } = await import("@/app/api/auth/register/route");
    const ip = "5.5.5.5";

    // First 5 attempts (some may fail validation — that's fine, they still count)
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ name: "x", email: `x${i}@t.com`, password: "short" }, ip));
    }

    const res = await POST(makeRequest({ name: "x", email: "new@t.com", password: "short" }, ip));
    expect(res.status).toBe(429);
  });

  it("hashes the password before storing", async () => {
    const bcrypt = await import("bcryptjs");
    mockFindOne.mockResolvedValue(null);
    mockInsertOne.mockResolvedValue({ insertedId: { toString: () => "x" } });

    const { POST } = await import("@/app/api/auth/register/route");
    await POST(makeRequest({ name: "Ada", email: "ada@test.com", password: "Secret123!" }));

    expect(bcrypt.default.hash).toHaveBeenCalledWith("Secret123!", 12);
  });
});
