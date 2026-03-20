import { describe, test, expect, mock, beforeEach } from "bun:test";

let gcsState = {
  uploaded: [] as Array<{ path: string; buffer: Buffer; contentType: string }>,
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
  uploadBuffer: async (path: string, buffer: Buffer, contentType: string) => {
    gcsState.uploaded.push({ path, buffer, contentType });
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
  replacePreviewAccessEmails: async () => {},
  clearPreviewAccessEmails: async () => {},
}));

import {
  rewritePreviewAssetUrls,
  assembleBuildFiles,
  collectFontAwesomeFiles,
  publishPreview,
} from "../services/preview.js";

describe("rewritePreviewAssetUrls", () => {
  test("rewrites /assets/ references with leading slash (engine output format)", () => {
    const html = '<img src="/assets/logo.png" alt="Logo">';
    const result = rewritePreviewAssetUrls(html, "abc12345");
    expect(result).toBe(
      '<img src="/preview/abc12345/assets/logo.png" alt="Logo">',
    );
  });

  test("rewrites assets/ references without leading slash", () => {
    const html = '<img src="assets/logo.png" alt="Logo">';
    const result = rewritePreviewAssetUrls(html, "abc12345");
    expect(result).toBe(
      '<img src="/preview/abc12345/assets/logo.png" alt="Logo">',
    );
  });

  test("rewrites href with /assets/ prefix", () => {
    const html = '<link href="/assets/style.css" rel="stylesheet">';
    const result = rewritePreviewAssetUrls(html, "slug1234");
    expect(result).toContain('href="/preview/slug1234/assets/style.css"');
  });

  test("rewrites url() in CSS with /assets/ prefix", () => {
    const html =
      '<style>div { background: url(/assets/bg.png) no-repeat; }</style>';
    const result = rewritePreviewAssetUrls(html, "slug1234");
    expect(result).toContain("url(/preview/slug1234/assets/bg.png)");
  });

  test("rewrites single-quoted attributes with /assets/", () => {
    const html = "<img src='/assets/icon.svg'>";
    const result = rewritePreviewAssetUrls(html, "testslug");
    expect(result).toContain("src='/preview/testslug/assets/icon.svg'");
  });

  test("rewrites single-quoted attributes without leading slash", () => {
    const html = "<img src='assets/icon.svg'>";
    const result = rewritePreviewAssetUrls(html, "testslug");
    expect(result).toContain("src='/preview/testslug/assets/icon.svg'");
  });

  test("handles multiple references in one string", () => {
    const html =
      '<img src="/assets/a.png"><link href="/assets/b.css"><div style="background: url(/assets/c.jpg)">';
    const result = rewritePreviewAssetUrls(html, "s");
    expect(result).toContain('src="/preview/s/assets/a.png"');
    expect(result).toContain('href="/preview/s/assets/b.css"');
    expect(result).toContain("url(/preview/s/assets/c.jpg)");
  });

  test("does not rewrite non-asset URLs", () => {
    const html = '<img src="https://cdn.example.com/image.png">';
    expect(rewritePreviewAssetUrls(html, "slug")).toBe(html);
  });

  test("does not rewrite when no asset references", () => {
    const html = "<div>Hello world</div>";
    expect(rewritePreviewAssetUrls(html, "slug")).toBe(html);
  });
});

describe("assembleBuildFiles", () => {
  test("assembles pages with rewritten asset URLs", () => {
    const result = assembleBuildFiles(
      {
        pages: [
          {
            pageId: "home",
            platform: "web",
            html: '<img src="/assets/logo.png">',
            fileName: "home.html",
          },
        ],
        css: "body {}",
        js: "console.log('hi')",
        indexHtml: "<html>index</html>",
        platformIndexes: { web: "<html>web index</html>" },
      },
      "testslug",
    );

    const pageFile = result.find((f) => f.path === "web/home.html");
    expect(pageFile).toBeDefined();
    expect(pageFile!.content).toContain(
      '/preview/testslug/assets/logo.png',
    );
    expect(pageFile!.content).not.toContain('src="/assets/logo.png"');

    const cssFile = result.find((f) =>
      f.path === "web/_shared/wireframe.css",
    );
    expect(cssFile).toBeDefined();
    expect(cssFile!.content).toBe("body {}");

    const jsFile = result.find((f) =>
      f.path === "web/_shared/interactions.js",
    );
    expect(jsFile).toBeDefined();

    const indexFile = result.find((f) => f.path === "index.html");
    expect(indexFile).toBeDefined();

    const platformIndex = result.find((f) => f.path === "web/index.html");
    expect(platformIndex).toBeDefined();
  });

  test("uses pageId as filename fallback when fileName absent", () => {
    const result = assembleBuildFiles(
      {
        pages: [
          {
            pageId: "about",
            platform: "web",
            html: "<p>About</p>",
          },
        ],
        css: "",
        js: "",
        indexHtml: "",
        platformIndexes: {},
      },
      "slug",
    );

    expect(result.find((f) => f.path === "web/about.html")).toBeDefined();
  });

  test("creates shared files per platform", () => {
    const result = assembleBuildFiles(
      {
        pages: [
          { pageId: "p1", platform: "web", html: "<p>W</p>" },
          { pageId: "p2", platform: "mobile", html: "<p>M</p>" },
        ],
        css: ".c{}",
        js: "x()",
        indexHtml: "<html></html>",
        platformIndexes: {
          web: "<html>W</html>",
          mobile: "<html>M</html>",
        },
      },
      "slug",
    );

    expect(
      result.find((f) => f.path === "web/_shared/wireframe.css"),
    ).toBeDefined();
    expect(
      result.find((f) => f.path === "mobile/_shared/wireframe.css"),
    ).toBeDefined();
    expect(
      result.find((f) => f.path === "web/_shared/interactions.js"),
    ).toBeDefined();
    expect(
      result.find((f) => f.path === "mobile/_shared/interactions.js"),
    ).toBeDefined();
  });
});

describe("collectFontAwesomeFiles", () => {
  test("resolves Font Awesome files from package", () => {
    const files = collectFontAwesomeFiles();
    const cssFile = files.find((f) => f.path === "fa/css/all.min.css");
    expect(cssFile).toBeDefined();
    expect(cssFile!.contentType).toBe("text/css; charset=utf-8");
    expect(typeof cssFile!.content).toBe("string");
    expect((cssFile!.content as string).length).toBeGreaterThan(0);
    expect((cssFile!.content as string)).not.toContain("font-display:block");
    expect((cssFile!.content as string)).toContain("font-display:swap");

    const woff2Files = files.filter((f) => f.path.endsWith(".woff2"));
    expect(woff2Files.length).toBeGreaterThan(0);
    for (const wf of woff2Files) {
      expect(wf.contentType).toBe("font/woff2");
      expect(wf.path).toMatch(/^fa\/webfonts\/.+\.woff2$/);
    }
  });
});

describe("publishPreview", () => {
  beforeEach(() => {
    resetGcsState();
    membershipState = null;
    previewState = null;
    documentRows = [];
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

  test("rejects non-member", async () => {
    membershipState = null;
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

    await expect(publishPreview("user1", "proj1")).rejects.toThrow(
      /do not have access/,
    );
  });

  test("rejects viewer role", async () => {
    membershipState = { role: "viewer" };
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

    await expect(publishPreview("user1", "proj1")).rejects.toThrow(
      /Insufficient permissions/,
    );
  });

  test("rejects empty project", async () => {
    membershipState = { role: "editor" };
    documentRows = [];

    await expect(publishPreview("user1", "proj1")).rejects.toThrow(
      /no documents/,
    );
  });

  test("rejects on validation failure with error details", async () => {
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
    validationResult = {
      ok: false,
      errors: [{ code: "E001", message: "Missing manifest" }],
      warnings: [],
    };

    try {
      await publishPreview("user1", "proj1");
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.message).toContain("Validation failed");
      expect(err.details).toEqual([
        { code: "E001", message: "Missing manifest" },
      ]);
    }
  });

  test("rejects on build failure", async () => {
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
    buildResult = { ok: false, error: "Build exploded" };

    await expect(publishPreview("user1", "proj1")).rejects.toThrow(
      /Build exploded/,
    );
  });

  test("publishes successfully and uploads files to GCS", async () => {
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

    const result = await publishPreview("user1", "proj1");

    expect(result.slug).toBeTruthy();
    expect(result.slug.length).toBe(8);
    expect(result.url).toBe(`/preview/${result.slug}`);
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.accessMode).toBe("public");

    expect(gcsState.uploaded.length).toBeGreaterThan(0);

    const htmlUpload = gcsState.uploaded.find((u) =>
      u.path.includes("home.html"),
    );
    expect(htmlUpload).toBeDefined();
    const htmlContent = htmlUpload!.buffer.toString();
    expect(htmlContent).toContain(`/preview/${result.slug}/assets/logo.png`);
    expect(htmlContent).not.toContain('src="/assets/logo.png"');

    const faUpload = gcsState.uploaded.find((u) =>
      u.path.includes("fa/css/all.min.css"),
    );
    expect(faUpload).toBeDefined();
  });

  test("reuses existing slug on republish", async () => {
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
    previewState = {
      id: "preview-1",
      projectId: "proj1",
      slug: "existing1",
      accessMode: "public",
      passwordHash: null,
      buildUrl: "previews/existing1/",
      publishedAt: new Date("2026-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await publishPreview("user1", "proj1");
    expect(result.slug).toBe("existing1");
  });

  test("owner can publish", async () => {
    membershipState = { role: "owner" };
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

    const result = await publishPreview("user1", "proj1");
    expect(result.slug).toBeTruthy();
  });
});
