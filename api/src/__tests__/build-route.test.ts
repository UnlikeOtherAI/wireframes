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

import { handleBuildRoute } from "../routes/build.js";

function makeRequest(path: string, method = "POST"): Request {
  return new Request(`http://localhost${path}`, { method });
}

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("build route matching", () => {
  test("matches POST /projects/:uuid/build", () => {
    const result = handleBuildRoute(makeRequest(`/projects/${uuid}/build`));
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match GET /projects/:uuid/build", () => {
    const result = handleBuildRoute(
      makeRequest(`/projects/${uuid}/build`, "GET"),
    );
    expect(result).toBeNull();
  });

  test("does not match non-uuid project id", () => {
    const result = handleBuildRoute(
      makeRequest("/projects/not-a-uuid/build"),
    );
    expect(result).toBeNull();
  });

  test("does not match /projects/:uuid without /build", () => {
    const result = handleBuildRoute(makeRequest(`/projects/${uuid}`));
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleBuildRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match /projects/:uuid/build/extra", () => {
    const result = handleBuildRoute(
      makeRequest(`/projects/${uuid}/build/extra`),
    );
    expect(result).toBeNull();
  });
});
