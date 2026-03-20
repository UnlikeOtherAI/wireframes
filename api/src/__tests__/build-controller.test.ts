import { describe, test, expect, mock, beforeEach } from "bun:test";

let repoState = {
  membership: null as { role: string } | null,
  documents: [] as any[],
};

let engineState = {
  validateResult: { ok: true, errors: [], warnings: [] } as any,
  buildResult: null as any,
};

function resetState() {
  repoState = {
    membership: null,
    documents: [],
  };
  engineState = {
    validateResult: { ok: true, errors: [], warnings: [] },
    buildResult: null,
  };
}

mock.module("../config.js", () => ({
  config: {
    port: 3001,
    databaseUrl: "",
    corsOrigins: [],
    jwtSecret: "test-secret",
    ssoVerifyUrl: "https://sso.test/verify",
  },
}));

mock.module("../repositories/project.js", () => ({
  findMembership: async () => repoState.membership,
  findProjectsByUserId: async () => [],
  findProjectById: async () => null,
  countMembers: async () => 0,
  countDocuments: async () => 0,
  createProjectWithOwner: async () => null,
  updateProject: async () => null,
  deleteProject: async () => {},
}));

mock.module("../repositories/document.js", () => ({
  findDocumentsByProjectId: async () => repoState.documents,
}));

mock.module("../services/engine.js", () => ({
  validateProject: () => engineState.validateResult,
  buildProject: () => engineState.buildResult,
}));

import { buildProjectController } from "../controllers/build.js";
import { errorHandler } from "../middleware/error-handler.js";
import { auth } from "../middleware/auth.js";
import { signJwt } from "../services/jwt.js";

const testJwt = signJwt(
  { userId: "user-1", email: "test@example.com" },
  "test-secret",
);

function makeRequest(
  path: string,
  method: string,
  withAuth = true,
): Request {
  const headers: Record<string, string> = {};
  if (withAuth) headers["Authorization"] = `Bearer ${testJwt}`;
  return new Request(`http://localhost${path}`, { method, headers });
}

const projectId = "00000000-0000-0000-0000-000000000001";
const handler = errorHandler(
  auth((r) => buildProjectController(r, projectId)),
);

describe("buildProjectController", () => {
  beforeEach(resetState);

  test("returns 401 without auth", async () => {
    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST", false),
    );
    expect(res.status).toBe(401);
  });

  test("returns 403 for non-member", async () => {
    repoState.membership = null;

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 422 when project has no documents", async () => {
    repoState.membership = { role: "viewer" };
    repoState.documents = [];

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("no documents");
  });

  test("returns 422 when validation fails", async () => {
    repoState.membership = { role: "editor" };
    repoState.documents = [
      {
        id: "d1",
        projectId,
        documentType: "manifest",
        documentId: "manifest",
        content: "manifest:\n  name: Test",
        contentHash: "abc",
      },
    ];
    engineState.validateResult = {
      ok: false,
      errors: [{ code: "MISSING_TEMPLATE", message: "Template missing" }],
      warnings: [],
    };

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("Validation failed");
  });

  test("returns 422 when build fails", async () => {
    repoState.membership = { role: "editor" };
    repoState.documents = [
      {
        id: "d1",
        projectId,
        documentType: "manifest",
        documentId: "manifest",
        content: "manifest:\n  name: Test",
        contentHash: "abc",
      },
    ];
    engineState.validateResult = { ok: true, errors: [], warnings: [] };
    engineState.buildResult = { ok: false, error: "Page missing viewport" };

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("Page missing viewport");
  });

  test("returns build output on success", async () => {
    repoState.membership = { role: "viewer" };
    repoState.documents = [
      {
        id: "d1",
        projectId,
        documentType: "manifest",
        documentId: "manifest",
        content: "manifest:\n  name: Test",
        contentHash: "abc",
      },
    ];
    engineState.validateResult = { ok: true, errors: [], warnings: [] };
    engineState.buildResult = {
      ok: true,
      pages: [{ pageId: "home", platform: "web", html: "<div>Home</div>" }],
      css: "body {}",
      js: "console.log('hi')",
      routeTable: { home: "home.html" },
      indexHtml: "<html>index</html>",
      platformIndexes: { web: "<html>web index</html>" },
    };

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pages).toHaveLength(1);
    expect(body.pages[0].pageId).toBe("home");
    expect(body.pages[0].html).toBe("<div>Home</div>");
    expect(body.css).toBe("body {}");
    expect(body.js).toBe("console.log('hi')");
    expect(body.routeTable).toEqual({ home: "home.html" });
    expect(body.indexHtml).toBeDefined();
    expect(body.platformIndexes).toBeDefined();
  });

  test("viewer can trigger build", async () => {
    repoState.membership = { role: "viewer" };
    repoState.documents = [
      {
        id: "d1",
        projectId,
        documentType: "manifest",
        documentId: "manifest",
        content: "manifest:\n  name: Test",
        contentHash: "abc",
      },
    ];
    engineState.validateResult = { ok: true, errors: [], warnings: [] };
    engineState.buildResult = {
      ok: true,
      pages: [],
      css: "",
      js: "",
      routeTable: {},
      indexHtml: "",
      platformIndexes: {},
    };

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid platform query param", async () => {
    repoState.membership = { role: "editor" };

    const res = await handler(
      makeRequest(
        `/projects/${projectId}/build?platform=invalid`,
        "POST",
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid platform");
  });

  test("passes platform filter to build", async () => {
    repoState.membership = { role: "editor" };
    repoState.documents = [
      {
        id: "d1",
        projectId,
        documentType: "manifest",
        documentId: "manifest",
        content: "manifest:\n  name: Test",
        contentHash: "abc",
      },
    ];
    engineState.validateResult = { ok: true, errors: [], warnings: [] };
    engineState.buildResult = {
      ok: true,
      pages: [{ pageId: "home", platform: "web", html: "<div/>" }],
      css: "",
      js: "",
      routeTable: {},
      indexHtml: "",
      platformIndexes: {},
    };

    const res = await handler(
      makeRequest(`/projects/${projectId}/build?platform=web`, "POST"),
    );
    expect(res.status).toBe(200);
  });

  test("returns 422 for invalid YAML content", async () => {
    repoState.membership = { role: "editor" };
    repoState.documents = [
      {
        id: "d1",
        projectId,
        documentType: "manifest",
        documentId: "manifest",
        content: ":\n  invalid: yaml: [broken",
        contentHash: "abc",
      },
    ];

    const res = await handler(
      makeRequest(`/projects/${projectId}/build`, "POST"),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("Invalid YAML");
  });
});
