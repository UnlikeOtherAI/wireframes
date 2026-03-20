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

import { handleUserProfileRoute } from "../routes/user-profile.js";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("user profile route matching", () => {
  test("matches GET /users/me", () => {
    const result = handleUserProfileRoute(makeRequest("/users/me"));
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches PATCH /users/me", () => {
    const result = handleUserProfileRoute(makeRequest("/users/me", "PATCH"));
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches DELETE /users/me", () => {
    const result = handleUserProfileRoute(
      makeRequest("/users/me", "DELETE"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match PUT /users/me", () => {
    const result = handleUserProfileRoute(makeRequest("/users/me", "PUT"));
    expect(result).toBeNull();
  });

  test("matches GET /users/me/invites", () => {
    const result = handleUserProfileRoute(
      makeRequest("/users/me/invites"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match POST /users/me/invites", () => {
    const result = handleUserProfileRoute(
      makeRequest("/users/me/invites", "POST"),
    );
    expect(result).toBeNull();
  });

  test("matches POST /users/me/invites/:uuid/decline", () => {
    const result = handleUserProfileRoute(
      makeRequest(
        "/users/me/invites/550e8400-e29b-41d4-a716-446655440000/decline",
        "POST",
      ),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match non-uuid invite id in decline", () => {
    const result = handleUserProfileRoute(
      makeRequest("/users/me/invites/not-a-uuid/decline", "POST"),
    );
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleUserProfileRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match /users/some-id", () => {
    const result = handleUserProfileRoute(
      makeRequest("/users/550e8400-e29b-41d4-a716-446655440000"),
    );
    expect(result).toBeNull();
  });
});
