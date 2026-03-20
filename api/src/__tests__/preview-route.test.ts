import { describe, test, expect } from "bun:test";
import { handlePreviewRoute } from "../routes/preview.js";

function makeRequest(
  path: string,
  method = "GET",
  ip = "127.0.0.1",
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "X-Forwarded-For": ip },
  });
}

describe("preview route", () => {
  test("returns null for non-preview paths", () => {
    expect(handlePreviewRoute(makeRequest("/health"))).toBeNull();
  });

  test("returns null for GET /preview/:slug/auth", () => {
    expect(handlePreviewRoute(makeRequest("/preview/my-slug/auth"))).toBeNull();
  });

  test("handles POST /preview/:slug/auth", async () => {
    const result = handlePreviewRoute(
      makeRequest("/preview/my-slug/auth", "POST"),
    );
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(501);
  });

  test("rate limits POST /preview/:slug/auth after 5 requests", async () => {
    const ip = "10.99.99.1";
    for (let i = 0; i < 5; i++) {
      const result = handlePreviewRoute(
        makeRequest("/preview/test-slug/auth", "POST", ip),
      );
      expect(result).not.toBeNull();
      await result!;
    }

    const limited = handlePreviewRoute(
      makeRequest("/preview/test-slug/auth", "POST", ip),
    );
    expect(limited).not.toBeNull();
    const res = await limited!;
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  test("tracks different IPs independently for preview auth", async () => {
    const result1 = handlePreviewRoute(
      makeRequest("/preview/s/auth", "POST", "10.88.88.1"),
    );
    expect(result1).not.toBeNull();
    const res1 = await result1!;
    expect(res1.status).toBe(501);

    const result2 = handlePreviewRoute(
      makeRequest("/preview/s/auth", "POST", "10.88.88.2"),
    );
    expect(result2).not.toBeNull();
    const res2 = await result2!;
    expect(res2.status).toBe(501);
  });
});
