import { describe, test, expect, mock, beforeEach } from "bun:test";

let previewState: Record<string, unknown> | null = null;
let emailList: string[] = [];
let downloadResult: { buffer: Buffer; contentType: string } = {
  buffer: Buffer.from("<html>preview</html>"),
  contentType: "text/html; charset=utf-8",
};
let ssoValidateResult: {
  ssoSubject: string;
  email: string;
  displayName: string | null;
} | null = null;

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
  findPreviewAccessEmails: async () => emailList,
  createPreview: async () => previewState,
  updatePreviewBuild: async () => previewState,
  updatePreviewAccess: async () => previewState,
  replacePreviewAccessEmails: async () => {},
  clearPreviewAccessEmails: async () => {},
}));

mock.module("../services/sso.js", () => ({
  validateSsoToken: async () => ssoValidateResult,
}));

mock.module("../services/gcs.js", () => ({
  uploadBuffer: async () => {},
  listFiles: async () => [],
  deleteFile: async () => {},
  downloadFile: async () => downloadResult,
}));

import { handlePreviewRoute } from "../routes/preview.js";

function makeRequest(
  path: string,
  method = "GET",
  options?: { ip?: string; cookie?: string; body?: unknown },
): Request {
  const headers: Record<string, string> = {};
  if (options?.ip) headers["X-Forwarded-For"] = options.ip;
  if (options?.cookie) headers["Cookie"] = options.cookie;

  const init: RequestInit = { method, headers };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  return new Request(`http://localhost${path}`, init);
}

describe("preview view route", () => {
  beforeEach(() => {
    previewState = null;
    emailList = [];
    ssoValidateResult = null;
    downloadResult = {
      buffer: Buffer.from("<html>preview</html>"),
      contentType: "text/html; charset=utf-8",
    };
  });

  test("returns null for non-preview paths", () => {
    expect(handlePreviewRoute(makeRequest("/health"))).toBeNull();
  });

  test("handles GET /preview/:slug", async () => {
    previewState = {
      id: "p1",
      slug: "myslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/myslug/",
    };

    const result = handlePreviewRoute(makeRequest("/preview/myslug"));
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("<html>preview</html>");
  });

  test("handles GET /preview/:slug/web/home.html", async () => {
    previewState = {
      id: "p1",
      slug: "myslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/myslug/",
    };

    const result = handlePreviewRoute(
      makeRequest("/preview/myslug/web/home.html"),
    );
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(200);
  });

  test("returns 401 for password-protected preview", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: "hashed",
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    const result = handlePreviewRoute(makeRequest("/preview/pwslug"));
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.requiresAuth).toBe("password");
  });

  test("returns 401 for sso-protected preview", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };

    const result = handlePreviewRoute(makeRequest("/preview/ssoslug"));
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.requiresAuth).toBe("sso");
    expect(body.ssoUrl).toBe("https://sso.test/verify");
  });

  test("returns 404 for non-existent slug", async () => {
    const result = handlePreviewRoute(makeRequest("/preview/missing"));
    expect(result).not.toBeNull();

    try {
      await result!;
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
    }
  });
});

describe("preview auth route", () => {
  beforeEach(() => {
    previewState = null;
    emailList = [];
    ssoValidateResult = null;
  });

  test("returns null for GET /preview/:slug/auth", () => {
    expect(handlePreviewRoute(makeRequest("/preview/my-slug/auth"))).toBeNull();
  });

  test("handles POST /preview/:slug/auth for password mode", async () => {
    const hash = await Bun.password.hash("secret", {
      algorithm: "bcrypt",
      cost: 4,
    });
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: hash,
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    const result = handlePreviewRoute(
      makeRequest("/preview/pwslug/auth", "POST", {
        body: { password: "secret" },
      }),
    );
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(res.headers.get("Set-Cookie")).toContain("preview_session_pwslug=");
    expect(res.headers.get("Set-Cookie")).toContain("HttpOnly");
  });

  test("rate limits POST /preview/:slug/auth after 5 requests", async () => {
    const ip = "10.99.99.2";
    for (let i = 0; i < 5; i++) {
      const result = handlePreviewRoute(
        makeRequest("/preview/test-slug/auth", "POST", { ip }),
      );
      expect(result).not.toBeNull();
      await result!.catch(() => {});
    }

    const limited = handlePreviewRoute(
      makeRequest("/preview/test-slug/auth", "POST", { ip }),
    );
    expect(limited).not.toBeNull();
    const res = await limited!;
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  test("handles POST /preview/:slug/auth for SSO mode with valid token", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    emailList = ["user@test.com"];
    ssoValidateResult = {
      ssoSubject: "sub-1",
      email: "user@test.com",
      displayName: "Test User",
    };

    const result = handlePreviewRoute(
      makeRequest("/preview/ssoslug/auth", "POST", {
        body: { ssoToken: "valid-sso-token" },
      }),
    );
    expect(result).not.toBeNull();
    const res = await result!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(res.headers.get("Set-Cookie")).toContain("preview_session_ssoslug=");
  });

  test("rejects POST /preview/:slug/auth for SSO mode with invalid token", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    ssoValidateResult = null;

    const result = handlePreviewRoute(
      makeRequest("/preview/ssoslug/auth", "POST", {
        body: { ssoToken: "bad-token" },
      }),
    );
    expect(result).not.toBeNull();
    try {
      await result!;
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
    }
  });

  test("rejects POST /preview/:slug/auth for SSO mode when email not in allowlist", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    emailList = ["other@test.com"];
    ssoValidateResult = {
      ssoSubject: "sub-1",
      email: "unauthorized@test.com",
      displayName: null,
    };

    const result = handlePreviewRoute(
      makeRequest("/preview/ssoslug/auth", "POST", {
        body: { ssoToken: "valid-token" },
      }),
    );
    expect(result).not.toBeNull();
    try {
      await result!;
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
    }
  });
});
