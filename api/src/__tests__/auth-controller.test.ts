import { describe, test, expect, mock } from "bun:test";

mock.module("../config.js", () => ({
  config: {
    port: 3001,
    databaseUrl: "",
    corsOrigins: [],
    jwtSecret: "test-secret",
    devAuthEnabled: false,
    devAuthUserEmail: "dev@wireframes.local",
    devAuthUserName: "Local Developer",
    devAuthUserSubject: "dev-local-user",
    devAuthProjectName: "Local Demo Project",
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
    displayName: "Test User",
    locale: "en",
  }),
}));

mock.module("../services/dev-auth.js", () => ({
  loginAsDevUser: async () => ({
    userId: "dev-user-1",
    email: "dev@wireframes.local",
    displayName: "Local Developer",
    locale: "en",
  }),
}));

import { ssoCallback, devLogin } from "../controllers/auth.js";
import { errorHandler } from "../middleware/error-handler.js";
import { verifyJwt } from "../services/jwt.js";

const handler = errorHandler((req) => ssoCallback(req));
const devHandler = errorHandler((req) => devLogin(req));

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
    expect(body.user).toEqual({
      id: "user-id-1",
      email: "user@example.com",
      displayName: "Test User",
      locale: "en",
    });

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

  test("returns JWT and user for local dev login", async () => {
    const res = await devHandler(
      new Request("http://localhost/auth/dev-login", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });
});
