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

import { handleDocumentRoute } from "../routes/document.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("document route matching", () => {
  test("matches GET /projects/:uuid/documents", () => {
    const result = handleDocumentRoute(makeRequest(`/projects/${UUID}/documents`));
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches GET /projects/:uuid/documents/:type/:id", () => {
    const result = handleDocumentRoute(
      makeRequest(`/projects/${UUID}/documents/page/home`),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches PUT /projects/:uuid/documents/:type", () => {
    const result = handleDocumentRoute(
      makeRequest(`/projects/${UUID}/documents/page`, "PUT"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches DELETE /projects/:uuid/documents/:type/:id", () => {
    const result = handleDocumentRoute(
      makeRequest(`/projects/${UUID}/documents/page/home`, "DELETE"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match POST /projects/:uuid/documents", () => {
    const result = handleDocumentRoute(
      makeRequest(`/projects/${UUID}/documents`, "POST"),
    );
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleDocumentRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match non-uuid project id", () => {
    const result = handleDocumentRoute(
      makeRequest("/projects/not-a-uuid/documents"),
    );
    expect(result).toBeNull();
  });
});
