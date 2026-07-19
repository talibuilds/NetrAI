import { vi } from "vitest";

// Silence next-auth internals that try to read process.env.AUTH_* at import time
process.env.AUTH_SECRET = "test-secret-for-vitest-only";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.MINIO_BUCKET = "test-bucket";
process.env.MINIO_ENDPOINT = "127.0.0.1";
process.env.MINIO_PORT = "9000";
process.env.MINIO_USE_SSL = "false";
process.env.MINIO_ACCESS_KEY = "test-key";
process.env.MINIO_SECRET_KEY = "test-secret";

// Reset all mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});
