import { describe, test, expect, mock } from "bun:test";

mock.module("../config.js", () => ({
  config: {
    port: 3001,
    databaseUrl: "",
    corsOrigins: [],
    jwtSecret: "test-secret",
    devAuthEnabled: true,
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
        ssoSubject: "sub-1",
        email: "user@example.com",
        displayName: "User",
      };
    }
    return null;
  },
}));

mock.module("../services/user.js", () => ({
  findOrCreateUser: async () => ({
    userId: "uid-1",
    email: "user@example.com",
    displayName: "User",
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

import { handleAuthRoute } from "../routes/auth.js";

function makeRequest(
  path: string,
  method = "GET",
  body?: unknown,
): Request {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(`http://localhost${path}`, init);
}

describe("auth route", () => {
  test("returns null for non-auth paths", () => {
    const result = handleAuthRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("returns null for GET /auth/sso", () => {
    const result = handleAuthRoute(makeRequest("/auth/sso"));
    expect(result).toBeNull();
  });

  test("handles POST /auth/sso", async () => {
    const result = handleAuthRoute(
      makeRequest("/auth/sso", "POST", { token: "valid-sso-token" }),
    );
    expect(result).not.toBeNull();

    const res = await result!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("user@example.com");
  });

  test("handles POST /auth/dev-login", async () => {
    const result = handleAuthRoute(makeRequest("/auth/dev-login", "POST"));
    expect(result).not.toBeNull();

    const res = await result!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user).toEqual({
      id: "dev-user-1",
      email: "dev@wireframes.local",
      displayName: "Local Developer",
      locale: "en",
    });
  });

  test("rate limits POST /auth/sso after 10 requests", async () => {
    // Create fresh requests to avoid shared state issues
    for (let i = 0; i < 10; i++) {
      const req = makeRequest("/auth/sso", "POST", {
        token: "valid-sso-token",
      });
      // Use unique IP per test run to avoid collisions with other tests
      const result = handleAuthRoute(
        new Request("http://localhost/auth/sso", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "10.0.0.99",
          },
          body: JSON.stringify({ token: "valid-sso-token" }),
        }),
      );
      expect(result).not.toBeNull();
      await result!;
    }

    const limited = handleAuthRoute(
      new Request("http://localhost/auth/sso", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "10.0.0.99",
        },
        body: JSON.stringify({ token: "valid-sso-token" }),
      }),
    );
    expect(limited).not.toBeNull();
    const res = await limited!;
    expect(res.status).toBe(429);
  });
});
