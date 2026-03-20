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

import { handleProjectRoute } from "../routes/project.js";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("project route matching", () => {
  test("matches GET /projects", () => {
    const result = handleProjectRoute(makeRequest("/projects"));
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches POST /projects", () => {
    const result = handleProjectRoute(makeRequest("/projects", "POST"));
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match PUT /projects", () => {
    const result = handleProjectRoute(makeRequest("/projects", "PUT"));
    expect(result).toBeNull();
  });

  test("matches GET /projects/:uuid", () => {
    const result = handleProjectRoute(
      makeRequest("/projects/550e8400-e29b-41d4-a716-446655440000"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches PATCH /projects/:uuid", () => {
    const result = handleProjectRoute(
      makeRequest("/projects/550e8400-e29b-41d4-a716-446655440000", "PATCH"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches DELETE /projects/:uuid", () => {
    const result = handleProjectRoute(
      makeRequest("/projects/550e8400-e29b-41d4-a716-446655440000", "DELETE"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match non-uuid project id", () => {
    const result = handleProjectRoute(makeRequest("/projects/not-a-uuid"));
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleProjectRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match sub-paths like /projects/:id/documents", () => {
    const result = handleProjectRoute(
      makeRequest("/projects/550e8400-e29b-41d4-a716-446655440000/documents"),
    );
    expect(result).toBeNull();
  });
});
