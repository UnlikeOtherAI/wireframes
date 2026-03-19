import { describe, test, expect } from "bun:test";
import { router } from "../routes/index.js";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("router", () => {
  test("returns 404 for unknown routes", async () => {
    const res = await router(makeRequest("/nonexistent"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  test("routes GET /health to health controller", async () => {
    // This will fail to connect to DB in tests but should still return a response
    const res = await router(makeRequest("/health"));
    // Without a real DB, health returns degraded (503) or ok (200)
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("db");
  });

  test("returns 404 for POST /health", async () => {
    const res = await router(makeRequest("/health", "POST"));
    expect(res.status).toBe(404);
  });
});
