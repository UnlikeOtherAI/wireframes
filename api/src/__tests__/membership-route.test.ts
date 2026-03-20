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

import { handleMembershipRoute } from "../routes/membership.js";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "660e8400-e29b-41d4-a716-446655440000";
const TOKEN = "a".repeat(64);

describe("membership route matching", () => {
  test("matches GET /projects/:uuid/members", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/members`),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match PUT /projects/:uuid/members", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/members`, "PUT"),
    );
    expect(result).toBeNull();
  });

  test("matches POST /projects/:uuid/invite", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/invite`, "POST"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match GET /projects/:uuid/invite", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/invite`),
    );
    expect(result).toBeNull();
  });

  test("matches POST /invites/:token/accept", () => {
    const result = handleMembershipRoute(
      makeRequest(`/invites/${TOKEN}/accept`, "POST"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match GET /invites/:token/accept", () => {
    const result = handleMembershipRoute(
      makeRequest(`/invites/${TOKEN}/accept`),
    );
    expect(result).toBeNull();
  });

  test("does not match /invites with short token", () => {
    const result = handleMembershipRoute(
      makeRequest("/invites/shorttoken/accept", "POST"),
    );
    expect(result).toBeNull();
  });

  test("matches PATCH /projects/:uuid/members/:uuid", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/members/${UUID2}`, "PATCH"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches DELETE /projects/:uuid/members/:uuid", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/members/${UUID2}`, "DELETE"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match POST /projects/:uuid/members/:uuid", () => {
    const result = handleMembershipRoute(
      makeRequest(`/projects/${UUID}/members/${UUID2}`, "POST"),
    );
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleMembershipRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match /projects/:uuid (no sub-path)", () => {
    const result = handleMembershipRoute(makeRequest(`/projects/${UUID}`));
    expect(result).toBeNull();
  });
});
