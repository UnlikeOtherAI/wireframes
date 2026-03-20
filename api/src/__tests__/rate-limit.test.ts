import { describe, test, expect } from "bun:test";
import { createRateLimiter, getClientIp } from "../middleware/rate-limit.js";

function makeRequest(
  ip = "127.0.0.1",
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/test", {
    headers: { "X-Forwarded-For": ip, ...headers },
  });
}

describe("getClientIp", () => {
  test("extracts IP from X-Forwarded-For", () => {
    const req = new Request("http://localhost/test", {
      headers: { "X-Forwarded-For": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  test("falls back to X-Real-IP", () => {
    const req = new Request("http://localhost/test", {
      headers: { "X-Real-IP": "9.8.7.6" },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  test("returns unknown when no IP headers", () => {
    const req = new Request("http://localhost/test");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("createRateLimiter", () => {
  test("allows requests within limit", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    expect(limiter(makeRequest("1.1.1.1"))).toBeNull();
    expect(limiter(makeRequest("1.1.1.1"))).toBeNull();
    expect(limiter(makeRequest("1.1.1.1"))).toBeNull();
  });

  test("blocks requests over the limit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    expect(limiter(makeRequest("2.2.2.2"))).toBeNull();
    expect(limiter(makeRequest("2.2.2.2"))).toBeNull();

    const result = limiter(makeRequest("2.2.2.2"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  test("returns 429 with Retry-After header", async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter(makeRequest("3.3.3.3"));

    const result = limiter(makeRequest("3.3.3.3"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    expect(result!.headers.get("Retry-After")).toBeTruthy();

    const body = await result!.json();
    expect(body.error).toBe("Too Many Requests");
  });

  test("tracks different IPs independently", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(limiter(makeRequest("4.4.4.4"))).toBeNull();
    expect(limiter(makeRequest("5.5.5.5"))).toBeNull();

    expect(limiter(makeRequest("4.4.4.4"))).not.toBeNull();
    expect(limiter(makeRequest("5.5.5.5"))).not.toBeNull();
  });

  test("allows requests after window expires", async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 50 });
    expect(limiter(makeRequest("6.6.6.6"))).toBeNull();
    expect(limiter(makeRequest("6.6.6.6"))).not.toBeNull();

    await new Promise((r) => setTimeout(r, 60));

    expect(limiter(makeRequest("6.6.6.6"))).toBeNull();
  });
});
