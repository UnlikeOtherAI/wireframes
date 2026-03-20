import { describe, test, expect, mock, beforeEach } from "bun:test";

let gcsState = {
  uploaded: [] as Array<{
    path: string;
    buffer: Buffer;
    contentType: string;
    cacheControl?: string;
  }>,
};

function resetGcsState() {
  gcsState = { uploaded: [] };
}

let membershipState: { role: string } | null = null;
let documentRows: Array<{
  id: string;
  projectId: string;
  documentType: string;
  documentId: string;
  content: string;
  contentHash: string;
}> = [];

let validationResult = { ok: true, errors: [] as unknown[], warnings: [] };
let buildResult: Record<string, unknown> = {
  ok: true,
  pages: [],
  css: "",
  js: "",
  routeTable: {},
  indexHtml: "",
  platformIndexes: {},
};

let previewState: Record<string, unknown> | null = null;
let emailActions: Array<{ action: string; emails?: string[] }> = [];

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

mock.module("../repositories/project.js", () => ({
  findMembership: async () => membershipState,
  findProjectsByUserId: async () => [],
  findProjectById: async () => null,
  countMembers: async () => 0,
  countDocuments: async () => 0,
  createProjectWithOwner: async () => null,
  updateProject: async () => null,
  deleteProject: async () => {},
}));

mock.module("../repositories/document.js", () => ({
  findDocumentsByProjectId: async () => documentRows,
}));

mock.module("../services/engine.js", () => ({
  validateProject: () => validationResult,
  buildProject: () => buildResult,
}));

mock.module("../services/gcs.js", () => ({
  uploadBuffer: async (
    path: string,
    buffer: Buffer,
    contentType: string,
    cacheControl?: string,
  ) => {
    gcsState.uploaded.push({ path, buffer, contentType, cacheControl });
  },
  listFiles: async () => [],
  deleteFile: async () => {},
  downloadFile: async () => ({ buffer: Buffer.from(""), contentType: "" }),
}));

mock.module("../repositories/preview.js", () => ({
  findPreviewByProjectId: async () => previewState,
  createPreview: async (data: Record<string, unknown>) => {
    previewState = {
      id: "preview-1",
      ...data,
    };
    return previewState;
  },
  updatePreviewBuild: async (
    _projectId: string,
    data: Record<string, unknown>,
  ) => {
    previewState = { ...previewState, ...data };
    return previewState;
  },
  updatePreviewAccess: async (
    _projectId: string,
    data: Record<string, unknown>,
  ) => {
    previewState = { ...previewState, ...data };
    return previewState;
  },
  findPreviewAccessEmails: async () => [],
  replacePreviewAccessEmails: async (_id: string, emails: string[]) => {
    emailActions.push({ action: "replace", emails });
  },
  clearPreviewAccessEmails: async () => {
    emailActions.push({ action: "clear" });
  },
}));

import {
  publishPreview,
  updatePreviewSettings,
} from "../services/preview.js";

describe("publishPreview - cache control", () => {
  beforeEach(() => {
    resetGcsState();
    membershipState = null;
    previewState = null;
    documentRows = [];
    emailActions = [];
    validationResult = { ok: true, errors: [], warnings: [] };
    buildResult = {
      ok: true,
      pages: [
        {
          pageId: "home",
          platform: "web",
          html: '<img src="/assets/logo.png">',
          fileName: "home.html",
        },
      ],
      css: "body {}",
      js: "console.log('x')",
      routeTable: {},
      indexHtml: "<html>main</html>",
      platformIndexes: { web: "<html>web</html>" },
    };
  });

  test("uploads preview files with private, max-age=3600 cache control", async () => {
    membershipState = { role: "editor" };
    documentRows = [
      {
        id: "d1",
        projectId: "p1",
        documentType: "page",
        documentId: "home",
        content: "page:\n  template: main",
        contentHash: "abc",
      },
    ];

    await publishPreview("user1", "proj1");

    expect(gcsState.uploaded.length).toBeGreaterThan(0);
    for (const upload of gcsState.uploaded) {
      expect(upload.cacheControl).toBe("private, max-age=3600");
    }
  });
});

describe("updatePreviewSettings", () => {
  beforeEach(() => {
    resetGcsState();
    membershipState = null;
    previewState = null;
    emailActions = [];
  });

  test("clears email list when switching to SSO without providing emails", async () => {
    membershipState = { role: "editor" };
    previewState = {
      id: "preview-1",
      projectId: "proj1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      buildUrl: "previews/testslug/",
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await updatePreviewSettings("user1", "proj1", { accessMode: "sso" });

    expect(emailActions).toEqual([{ action: "clear" }]);
  });

  test("replaces email list when switching to SSO with emails provided", async () => {
    membershipState = { role: "editor" };
    previewState = {
      id: "preview-1",
      projectId: "proj1",
      slug: "testslug",
      accessMode: "public",
      passwordHash: null,
      buildUrl: "previews/testslug/",
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await updatePreviewSettings("user1", "proj1", {
      accessMode: "sso",
      emails: ["a@test.com", "b@test.com"],
    });

    expect(emailActions).toEqual([
      { action: "replace", emails: ["a@test.com", "b@test.com"] },
    ]);
  });
});
