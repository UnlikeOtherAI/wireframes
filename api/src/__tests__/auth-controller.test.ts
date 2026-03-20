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

mock.module("../services/sso.js", () => ({
  validateSsoToken: async (token: string) => {
    if (token === "valid-sso-token") {
      return {
        ssoSubject: "sso-sub-1",
        email: "user@example.com",
        displayName: "Test User",
      };
    }
    return null;
  },
}));

mock.module("../services/user.js", () => ({
  findOrCreateUser: async () => ({
    userId: "user-id-1",
    email: "user@example.com",
  }),
}));

import { ssoCallback } from "../controllers/auth.js";
import { errorHandler } from "../middleware/error-handler.js";
import { verifyJwt } from "../services/jwt.js";

const handler = errorHandler((req) => ssoCallback(req));

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/auth/sso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth controller - ssoCallback", () => {
  test("returns JWT for valid SSO token", async () => {
    const res = await handler(makePostRequest({ token: "valid-sso-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();

    const payload = verifyJwt(body.token, "test-secret");
    expect(payload).toEqual({ userId: "user-id-1", email: "user@example.com" });
  });

  test("returns 401 for invalid SSO token", async () => {
    const res = await handler(makePostRequest({ token: "invalid-token" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid SSO token");
  });

  test("returns 400 for missing token", async () => {
    const res = await handler(makePostRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing or invalid token");
  });

  test("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/auth/sso", {
      method: "POST",
      body: "not json",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });
});
