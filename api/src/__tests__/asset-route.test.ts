import { describe, test, expect, mock } from "bun:test";

mock.module("../config.js", () => ({
  config: {
    port: 3001,
    databaseUrl: "",
    corsOrigins: [],
    jwtSecret: "test-secret",
    ssoVerifyUrl: "https://sso.test/verify",
    gcsBucket: "test-bucket",
    gcsServiceAccountKey: "",
  },
}));

import { handleAssetRoute } from "../routes/asset.js";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("asset route matching", () => {
  test("matches POST /projects/:uuid/assets", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets`, "POST"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches GET /projects/:uuid/assets", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets`, "GET"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches DELETE /projects/:uuid/assets/logo.png", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets/logo.png`, "DELETE"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match PUT /projects/:uuid/assets", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets`, "PUT"),
    );
    expect(result).toBeNull();
  });

  test("does not match non-uuid project id", () => {
    const result = handleAssetRoute(
      makeRequest("/projects/not-a-uuid/assets", "GET"),
    );
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleAssetRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match DELETE on collection endpoint", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets`, "DELETE"),
    );
    expect(result).toBeNull();
  });

  test("does not match GET on file endpoint", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets/logo.png`, "GET"),
    );
    expect(result).toBeNull();
  });

  test("rejects filenames with invalid characters in URL", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets/bad file!.png`, "DELETE"),
    );
    expect(result).toBeNull();
  });

  test("matches filenames with dots, hyphens, underscores", () => {
    const result = handleAssetRoute(
      makeRequest(`/projects/${uuid}/assets/my-image_v2.0.png`, "DELETE"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });
});
