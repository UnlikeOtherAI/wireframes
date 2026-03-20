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

import { handleChatRoute } from "../routes/chat.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "660e8400-e29b-41d4-a716-446655440000";

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("chat route matching", () => {
  test("matches POST /projects/:uuid/chat/sessions", () => {
    const result = handleChatRoute(
      makeRequest(`/projects/${UUID}/chat/sessions`, "POST"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match GET /projects/:uuid/chat/sessions", () => {
    const result = handleChatRoute(
      makeRequest(`/projects/${UUID}/chat/sessions`, "GET"),
    );
    expect(result).toBeNull();
  });

  test("matches GET /projects/:uuid/chat/sessions/:uuid", () => {
    const result = handleChatRoute(
      makeRequest(`/projects/${UUID}/chat/sessions/${UUID2}`, "GET"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("matches POST /projects/:uuid/chat/sessions/:uuid/messages", () => {
    const result = handleChatRoute(
      makeRequest(`/projects/${UUID}/chat/sessions/${UUID2}/messages`, "POST"),
    );
    expect(result).not.toBeNull();
    result?.catch(() => {});
  });

  test("does not match GET /projects/:uuid/chat/sessions/:uuid/messages", () => {
    const result = handleChatRoute(
      makeRequest(`/projects/${UUID}/chat/sessions/${UUID2}/messages`, "GET"),
    );
    expect(result).toBeNull();
  });

  test("does not match non-uuid project id", () => {
    const result = handleChatRoute(
      makeRequest("/projects/not-uuid/chat/sessions", "POST"),
    );
    expect(result).toBeNull();
  });

  test("does not match unrelated paths", () => {
    const result = handleChatRoute(makeRequest("/health"));
    expect(result).toBeNull();
  });

  test("does not match /projects/:uuid/chat (no /sessions)", () => {
    const result = handleChatRoute(
      makeRequest(`/projects/${UUID}/chat`, "POST"),
    );
    expect(result).toBeNull();
  });
});
