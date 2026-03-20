import { describe, test, expect, mock } from "bun:test";

mock.module("../config.js", () => ({
  config: {
    port: 3001,
    databaseUrl: "",
    corsOrigins: [],
    jwtSecret: "test-secret",
    ssoVerifyUrl: "https://sso.test/verify",
  },
}));

mock.module("../db/index.js", () => ({
  db: {},
  verifyConnection: async () => true,
  closeConnection: async () => {},
}));

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

  test("GET /health returns 200 with { status, timestamp }", async () => {
    const res = await router(makeRequest("/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(Object.keys(body)).toEqual(["status", "timestamp"]);
  });

  test("returns 404 for POST /health", async () => {
    const res = await router(makeRequest("/health", "POST"));
    expect(res.status).toBe(404);
  });
});
