import { describe, test, expect, mock, beforeEach } from "bun:test";

mock.module("../config.js", () => ({
  config: {
    port: 3001,
    databaseUrl: "",
    corsOrigins: [],
    jwtSecret: "test-secret",
    ssoVerifyUrl: "https://sso.test/verify",
  },
}));

import { auth, getUser } from "../middleware/auth.js";
import { signJwt } from "../services/jwt.js";
import type { Handler } from "../middleware/types.js";

const SECRET = "test-secret";

function makeRequest(
  path: string,
  method = "GET",
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost${path}`, { method, headers });
}

describe("auth middleware", () => {
  test("passes through public routes without auth", async () => {
    const handler: Handler = (req) =>
      Response.json({ user: getUser(req) });
    const wrapped = auth(handler);

    const res = await wrapped(makeRequest("/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  test("passes through POST /auth/sso without auth", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = auth(handler);

    const res = await wrapped(makeRequest("/auth/sso", "POST"));
    expect(res.status).toBe(200);
  });

  test("passes through GET /preview/:slug without auth", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = auth(handler);

    const res = await wrapped(makeRequest("/preview/my-slug"));
    expect(res.status).toBe(200);
  });

  test("passes through POST /preview/:slug/auth without auth", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = auth(handler);

    const res = await wrapped(makeRequest("/preview/my-slug/auth", "POST"));
    expect(res.status).toBe(200);
  });

  test("returns 401 for protected route without Authorization header", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = auth(handler);

    const res = await wrapped(makeRequest("/projects"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Missing or invalid authorization header");
  });

  test("returns 401 for invalid Bearer token format", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = auth(handler);

    const res = await wrapped(
      makeRequest("/projects", "GET", { Authorization: "Basic abc" }),
    );
    expect(res.status).toBe(401);
  });

  test("returns 401 for invalid JWT", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = auth(handler);

    const res = await wrapped(
      makeRequest("/projects", "GET", {
        Authorization: "Bearer invalid.jwt.token",
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid or expired token");
  });

  test("passes through with valid JWT and populates user", async () => {
    const token = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    let capturedReq: Request | null = null;
    const handler: Handler = (req) => {
      capturedReq = req;
      return Response.json({ user: getUser(req) });
    };
    const wrapped = auth(handler);

    const res = await wrapped(
      makeRequest("/projects", "GET", {
        Authorization: `Bearer ${token}`,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ userId: "u1", email: "a@b.com" });
  });

  test("getUser returns null for requests without auth context", () => {
    const req = makeRequest("/test");
    expect(getUser(req)).toBeNull();
  });
});
