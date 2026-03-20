import { describe, test, expect, mock, beforeEach } from "bun:test";

let previewState: Record<string, unknown> | null = null;

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

mock.module("../repositories/preview.js", () => ({
  findPreviewBySlug: async (slug: string) => {
    if (previewState && previewState.slug === slug) return previewState;
    return null;
  },
  findPreviewByProjectId: async () => previewState,
  findPreviewAccessEmails: async () => [],
  createPreview: async () => previewState,
  updatePreviewBuild: async () => previewState,
  updatePreviewAccess: async () => previewState,
  replacePreviewAccessEmails: async () => {},
  clearPreviewAccessEmails: async () => {},
}));

mock.module("../services/gcs.js", () => ({
  uploadBuffer: async () => {},
  listFiles: async () => [],
  deleteFile: async () => {},
  downloadFile: async () => ({
    buffer: Buffer.from("<html>preview</html>"),
    contentType: "text/html; charset=utf-8",
  }),
}));

import { handlePreviewRoute } from "../routes/preview.js";

function makeRequest(
  path: string,
  method = "GET",
  ip = "127.0.0.1",
  body?: unknown,
): Request {
  const headers: Record<string, string> = { "X-Forwarded-For": ip };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  return new Request(`http://localhost${path}`, init);
}

describe("preview route", () => {
  beforeEach(() => {
    previewState = null;
  });

  test("returns null for non-preview paths", () => {
    expect(handlePreviewRoute(makeRequest("/health"))).toBeNull();
  });

  test("returns null for GET /preview/:slug/auth", () => {
    expect(
      handlePreviewRoute(makeRequest("/preview/my-slug/auth")),
    ).toBeNull();
  });

  test("dispatches POST /preview/:slug/auth to controller", async () => {
    const result = handlePreviewRoute(
      makeRequest("/preview/my-slug/auth", "POST", "127.0.0.1", {
        password: "test",
      }),
    );
    expect(result).not.toBeNull();
    // Route dispatches correctly; the controller may throw (no preview in DB)
    await result!.catch(() => {});
  });

  test("rate limits POST /preview/:slug/auth after 5 requests", async () => {
    const ip = "10.99.99.11";
    for (let i = 0; i < 5; i++) {
      const result = handlePreviewRoute(
        makeRequest("/preview/test-slug/auth", "POST", ip, { password: "x" }),
      );
      expect(result).not.toBeNull();
      await result!.catch(() => {});
    }

    const limited = handlePreviewRoute(
      makeRequest("/preview/test-slug/auth", "POST", ip, { password: "x" }),
    );
    expect(limited).not.toBeNull();
    const res = await limited!;
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  test("tracks different IPs independently for preview auth", async () => {
    const result1 = handlePreviewRoute(
      makeRequest("/preview/s/auth", "POST", "10.88.88.11", { password: "x" }),
    );
    expect(result1).not.toBeNull();
    await result1!.catch(() => {});

    const result2 = handlePreviewRoute(
      makeRequest("/preview/s/auth", "POST", "10.88.88.12", { password: "x" }),
    );
    expect(result2).not.toBeNull();
    await result2!.catch(() => {});
  });

  test("handles GET /preview/:slug for public preview", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/testslug/",
    };

    const result = handlePreviewRoute(makeRequest("/preview/testslug"));
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(200);
  });

  test("handles GET /preview/:slug/web/page.html", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/testslug/",
    };

    const result = handlePreviewRoute(
      makeRequest("/preview/testslug/web/page.html"),
    );
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(200);
  });
});
