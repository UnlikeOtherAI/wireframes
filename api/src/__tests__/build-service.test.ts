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

mock.module("../repositories/project.js", () => ({
  findMembership: async () => ({ role: "editor" }),
  findProjectsByUserId: async () => [],
  findProjectById: async () => null,
  countMembers: async () => 0,
  countDocuments: async () => 0,
  createProjectWithOwner: async () => null,
  updateProject: async () => null,
  deleteProject: async () => {},
}));

mock.module("../repositories/document.js", () => ({
  findDocumentsByProjectId: async () => [],
}));

mock.module("../services/engine.js", () => ({
  validateProject: () => ({ ok: true, errors: [], warnings: [] }),
  buildProject: () => ({ ok: true, pages: [], css: "", js: "", routeTable: {}, indexHtml: "", platformIndexes: {} }),
}));

import { buildDocumentMap } from "../services/build.js";

describe("buildDocumentMap", () => {
  test("builds empty map from empty rows", () => {
    const map = buildDocumentMap([]);
    expect(map.manifest).toBeNull();
    expect(map.sitemap).toBeNull();
    expect(map.templates).toBeNull();
    expect(map.components).toBeNull();
    expect(map.pages.size).toBe(0);
    expect(map.datasets.size).toBe(0);
  });

  test("sets manifest from manifest row", () => {
    const map = buildDocumentMap([
      {
        id: "d1",
        projectId: "p1",
        documentType: "manifest",
        documentId: "manifest",
        content: "manifest:\n  name: Test",
        contentHash: "abc",
      },
    ]);
    expect(map.manifest).toEqual({ manifest: { name: "Test" } });
  });

  test("sets sitemap from sitemap row", () => {
    const map = buildDocumentMap([
      {
        id: "d2",
        projectId: "p1",
        documentType: "sitemap",
        documentId: "sitemap",
        content: "sitemap:\n  routes:\n    - page: home",
        contentHash: "abc",
      },
    ]);
    expect(map.sitemap).toEqual({
      sitemap: { routes: [{ page: "home" }] },
    });
  });

  test("sets templates from templates row", () => {
    const map = buildDocumentMap([
      {
        id: "d3",
        projectId: "p1",
        documentType: "templates",
        documentId: "templates",
        content: "templates:\n  main:\n    regions:\n      - id: body",
        contentHash: "abc",
      },
    ]);
    expect(map.templates).toBeDefined();
    expect((map.templates as any).templates.main).toBeDefined();
  });

  test("sets components from components row", () => {
    const map = buildDocumentMap([
      {
        id: "d4",
        projectId: "p1",
        documentType: "components",
        documentId: "components",
        content: "components:\n  button:\n    type: container",
        contentHash: "abc",
      },
    ]);
    expect(map.components).toBeDefined();
    expect((map.components as any).components.button).toBeDefined();
  });

  test("adds pages to pages map by documentId", () => {
    const map = buildDocumentMap([
      {
        id: "d5",
        projectId: "p1",
        documentType: "page",
        documentId: "home",
        content: "page:\n  template: main",
        contentHash: "abc",
      },
      {
        id: "d6",
        projectId: "p1",
        documentType: "page",
        documentId: "about",
        content: "page:\n  template: main",
        contentHash: "def",
      },
    ]);
    expect(map.pages.size).toBe(2);
    expect(map.pages.has("home")).toBe(true);
    expect(map.pages.has("about")).toBe(true);
    expect((map.pages.get("home") as any).page.template).toBe("main");
  });

  test("adds datasets to datasets map by documentId", () => {
    const map = buildDocumentMap([
      {
        id: "d7",
        projectId: "p1",
        documentType: "dataset",
        documentId: "users",
        content: "dataset:\n  items:\n    - name: Alice",
        contentHash: "abc",
      },
    ]);
    expect(map.datasets.size).toBe(1);
    expect(map.datasets.has("users")).toBe(true);
  });

  test("preserves row order in pages and datasets for deterministic output", () => {
    const makeRow = (type: string, docId: string) => ({
      id: docId,
      projectId: "p1",
      documentType: type,
      documentId: docId,
      content: type === "page"
        ? `page:\n  template: main`
        : `dataset:\n  items:\n    - name: ${docId}`,
      contentHash: docId,
    });

    // Rows sorted by document_type then document_id (as the repository now returns)
    const sortedRows = [
      makeRow("dataset", "cities"),
      makeRow("dataset", "users"),
      makeRow("page", "about"),
      makeRow("page", "contact"),
      makeRow("page", "home"),
    ];

    const map = buildDocumentMap(sortedRows);

    // Map iteration order must match insertion (sorted) order
    expect([...map.pages.keys()]).toEqual(["about", "contact", "home"]);
    expect([...map.datasets.keys()]).toEqual(["cities", "users"]);
  });

  test("throws ApiError for invalid YAML", () => {
    expect(() =>
      buildDocumentMap([
        {
          id: "d8",
          projectId: "p1",
          documentType: "manifest",
          documentId: "manifest",
          content: ":\n  bad: yaml: [broken",
          contentHash: "abc",
        },
      ]),
    ).toThrow(/Invalid YAML/);
  });
});
