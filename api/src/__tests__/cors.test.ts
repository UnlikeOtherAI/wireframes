import { describe, test, expect, beforeEach } from "bun:test";
import { cors } from "../middleware/cors.js";
import { config } from "../config.js";
import type { Handler } from "../middleware/types.js";

const handler: Handler = () => Response.json({ ok: true });

function makeRequest(
  origin: string,
  method = "GET",
): Request {
  return new Request("http://localhost/test", {
    method,
    headers: origin ? { Origin: origin } : {},
  });
}

describe("cors middleware", () => {
  beforeEach(() => {
    (config as { corsOrigins: string[] }).corsOrigins = [];
  });

  test("allows all origins when CORS_ORIGINS is empty", async () => {
    const wrapped = cors(handler);
    const res = await wrapped(makeRequest("http://example.com"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://example.com",
    );
  });

  test("allows matching origin", async () => {
    (config as { corsOrigins: string[] }).corsOrigins = [
      "http://allowed.com",
    ];
    const wrapped = cors(handler);
    const res = await wrapped(makeRequest("http://allowed.com"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://allowed.com",
    );
  });

  test("rejects non-matching origin", async () => {
    (config as { corsOrigins: string[] }).corsOrigins = [
      "http://allowed.com",
    ];
    const wrapped = cors(handler);
    const res = await wrapped(makeRequest("http://evil.com"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("handles preflight OPTIONS request", async () => {
    const wrapped = cors(handler);
    const res = await wrapped(makeRequest("http://example.com", "OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
