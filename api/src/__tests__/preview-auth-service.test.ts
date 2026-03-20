import { describe, test, expect, mock, beforeEach } from "bun:test";

let previewState: Record<string, unknown> | null = null;
let emailList: string[] = [];
let downloadResult: { buffer: Buffer; contentType: string } = {
  buffer: Buffer.from("<html>preview</html>"),
  contentType: "text/html; charset=utf-8",
};
let downloadError: Error | null = null;
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
    jwtSecret: "test-preview-secret",
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
  findPreviewAccessEmails: async () => emailList,
  findPreviewByProjectId: async () => previewState,
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
  downloadFile: async (path: string) => {
    if (downloadError) throw downloadError;
    return downloadResult;
  },
}));

import {
  signPreviewJwt,
  verifyPreviewJwt,
  viewPreview,
  authenticatePreview,
  buildPreviewCookie,
} from "../services/preview-auth.js";

describe("signPreviewJwt / verifyPreviewJwt", () => {
  const secret = "test-preview-secret";

  test("signs and verifies a valid preview JWT", () => {
    const token = signPreviewJwt("preview-123", secret);
    const payload = verifyPreviewJwt(token, secret);
    expect(payload).not.toBeNull();
    expect(payload!.previewId).toBe("preview-123");
    expect(payload!.accessGranted).toBe(true);
  });

  test("returns null for invalid token", () => {
    expect(verifyPreviewJwt("invalid.token.here", secret)).toBeNull();
  });

  test("returns null for wrong secret", () => {
    const token = signPreviewJwt("preview-123", secret);
    expect(verifyPreviewJwt(token, "wrong-secret")).toBeNull();
  });

  test("returns null for malformed token", () => {
    expect(verifyPreviewJwt("not-a-jwt", secret)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(verifyPreviewJwt("", secret)).toBeNull();
  });
});

describe("viewPreview", () => {
  beforeEach(() => {
    previewState = null;
    emailList = [];
    downloadResult = {
      buffer: Buffer.from("<html>preview</html>"),
      contentType: "text/html; charset=utf-8",
    };
    downloadError = null;
    ssoValidateResult = null;
  });

  test("returns 404 for non-existent slug", async () => {
    await expect(viewPreview("missing", "index.html", null)).rejects.toThrow(
      /not found/i,
    );
  });

  test("returns 404 for unpublished preview", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: null,
      buildUrl: "previews/testslug/",
    };
    await expect(
      viewPreview("testslug", "index.html", null),
    ).rejects.toThrow(/not found/i);
  });

  test("proxies content for public preview without auth", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/testslug/",
    };

    const result = await viewPreview("testslug", "index.html", null);
    expect(result.allowed).toBe(true);
    expect(result.buffer).toBeDefined();
    expect(result.contentType).toBe("text/html; charset=utf-8");
  });

  test("returns requiresAuth for password preview without cookie", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: "hashed",
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    const result = await viewPreview("pwslug", "index.html", null);
    expect(result.allowed).toBe(false);
    expect(result.requiresAuth).toBe("password");
  });

  test("returns requiresAuth for sso preview without cookie", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };

    const result = await viewPreview("ssoslug", "index.html", null);
    expect(result.allowed).toBe(false);
    expect(result.requiresAuth).toBe("sso");
    expect(result.ssoUrl).toBe("https://sso.test/verify");
  });

  test("allows access with valid preview cookie for password mode", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: "hashed",
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    const token = signPreviewJwt("p1", "test-preview-secret");
    const cookieHeader = `preview_session_pwslug=${token}`;

    const result = await viewPreview("pwslug", "index.html", cookieHeader);
    expect(result.allowed).toBe(true);
    expect(result.buffer).toBeDefined();
  });

  test("rejects invalid preview cookie", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: "hashed",
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    const cookieHeader = "preview_session_pwslug=invalid-token";
    const result = await viewPreview("pwslug", "index.html", cookieHeader);
    expect(result.allowed).toBe(false);
    expect(result.requiresAuth).toBe("password");
  });

  test("rejects cookie for wrong preview", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: "hashed",
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    const token = signPreviewJwt("other-preview-id", "test-preview-secret");
    const cookieHeader = `preview_session_pwslug=${token}`;

    const result = await viewPreview("pwslug", "index.html", cookieHeader);
    expect(result.allowed).toBe(false);
    expect(result.requiresAuth).toBe("password");
  });

  test("proxies sub-path resources", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/testslug/",
    };

    downloadResult = {
      buffer: Buffer.from("body {}"),
      contentType: "text/css; charset=utf-8",
    };

    const result = await viewPreview(
      "testslug",
      "web/_shared/wireframe.css",
      null,
    );
    expect(result.allowed).toBe(true);
    expect(result.contentType).toBe("text/css; charset=utf-8");
  });

  test("rejects path traversal with ..", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/testslug/",
    };

    await expect(
      viewPreview("testslug", "../other/file.html", null),
    ).rejects.toThrow(/Invalid path/);
  });

  test("rejects path starting with /", async () => {
    previewState = {
      id: "p1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/testslug/",
    };

    await expect(
      viewPreview("testslug", "/etc/passwd", null),
    ).rejects.toThrow(/Invalid path/);
  });
});

describe("authenticatePreview", () => {
  beforeEach(() => {
    previewState = null;
    emailList = [];
    ssoValidateResult = null;
  });

  test("returns 404 for non-existent preview", async () => {
    await expect(
      authenticatePreview("missing", { password: "test" }),
    ).rejects.toThrow(/not found/i);
  });

  test("returns 400 when password not provided for password mode", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: await Bun.password.hash("secret", {
        algorithm: "bcrypt",
        cost: 4,
      }),
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    await expect(authenticatePreview("pwslug", {})).rejects.toThrow(
      /Password is required/,
    );
  });

  test("returns 401 for wrong password", async () => {
    previewState = {
      id: "p1",
      slug: "pwslug",
      accessMode: "password",
      passwordHash: await Bun.password.hash("correct", {
        algorithm: "bcrypt",
        cost: 4,
      }),
      publishedAt: new Date(),
      buildUrl: "previews/pwslug/",
    };

    await expect(
      authenticatePreview("pwslug", { password: "wrong" }),
    ).rejects.toThrow(/Invalid password/);
  });

  test("returns token for correct password", async () => {
    const hash = await Bun.password.hash("correct", {
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

    const result = await authenticatePreview("pwslug", {
      password: "correct",
    });
    expect(result.token).toBeTruthy();
    expect(result.slug).toBe("pwslug");

    const payload = verifyPreviewJwt(result.token, "test-preview-secret");
    expect(payload).not.toBeNull();
    expect(payload!.previewId).toBe("p1");
  });

  test("returns 400 when ssoToken not provided for sso mode", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };

    await expect(authenticatePreview("ssoslug", {})).rejects.toThrow(
      /SSO token is required/,
    );
  });

  test("returns 401 for invalid SSO token", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    ssoValidateResult = null;

    await expect(
      authenticatePreview("ssoslug", { ssoToken: "invalid-token" }),
    ).rejects.toThrow(/Invalid SSO token/);
  });

  test("returns 403 for verified SSO email not in access list", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    emailList = ["allowed@test.com"];
    ssoValidateResult = {
      ssoSubject: "sub-1",
      email: "denied@test.com",
      displayName: null,
    };

    await expect(
      authenticatePreview("ssoslug", { ssoToken: "valid-token" }),
    ).rejects.toThrow(/not in access list/);
  });

  test("returns token for verified SSO email in access list", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    emailList = ["allowed@test.com"];
    ssoValidateResult = {
      ssoSubject: "sub-1",
      email: "allowed@test.com",
      displayName: "Test User",
    };

    const result = await authenticatePreview("ssoslug", {
      ssoToken: "valid-token",
    });
    expect(result.token).toBeTruthy();
    expect(result.slug).toBe("ssoslug");
  });

  test("SSO email comparison is case-insensitive", async () => {
    previewState = {
      id: "p1",
      slug: "ssoslug",
      accessMode: "sso",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/ssoslug/",
    };
    emailList = ["Allowed@Test.com"];
    ssoValidateResult = {
      ssoSubject: "sub-1",
      email: "allowed@test.com",
      displayName: null,
    };

    const result = await authenticatePreview("ssoslug", {
      ssoToken: "valid-token",
    });
    expect(result.token).toBeTruthy();
  });

  test("returns 400 for public preview auth attempt", async () => {
    previewState = {
      id: "p1",
      slug: "pubslug",
      accessMode: "public",
      passwordHash: null,
      publishedAt: new Date(),
      buildUrl: "previews/pubslug/",
    };

    await expect(
      authenticatePreview("pubslug", { password: "test" }),
    ).rejects.toThrow(/does not require authentication/);
  });
});

describe("buildPreviewCookie", () => {
  test("builds cookie with correct attributes", () => {
    const cookie = buildPreviewCookie("jwt-token-here", "myslug");
    expect(cookie).toContain("preview_session_myslug=jwt-token-here");
    expect(cookie).toContain("Path=/preview/myslug");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=86400");
  });
});
