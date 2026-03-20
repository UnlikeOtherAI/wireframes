import { describe, test, expect, mock, beforeEach } from "bun:test";

let gcsState = {
  uploaded: [] as Array<{ path: string; buffer: Buffer; contentType: string }>,
  files: [] as Array<{ name: string; contentType: string; size: number; updated: string }>,
  deleted: [] as string[],
};

function resetGcsState() {
  gcsState = { uploaded: [], files: [], deleted: [] };
}

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
  findMembership: async (_userId: string, _projectId: string) => {
    return membershipState;
  },
  findProjectsByUserId: async () => [],
  findProjectById: async () => null,
  countMembers: async () => 0,
  countDocuments: async () => 0,
  createProjectWithOwner: async () => null,
  updateProject: async () => null,
  deleteProject: async () => {},
}));

mock.module("../services/gcs.js", () => ({
  uploadBuffer: async (path: string, buffer: Buffer, contentType: string) => {
    gcsState.uploaded.push({ path, buffer, contentType });
  },
  listFiles: async (_prefix: string) => gcsState.files,
  deleteFile: async (path: string) => {
    gcsState.deleted.push(path);
  },
  getPublicUrl: (path: string) =>
    `https://storage.googleapis.com/test-bucket/${path}`,
}));

let membershipState: { role: string } | null = null;

import {
  sanitizeFilename,
  validateAssetFile,
  uploadAsset,
  listAssets,
  deleteAsset,
  rewriteAssetUrls,
} from "../services/asset.js";

describe("sanitizeFilename", () => {
  test("passes through valid filenames", () => {
    expect(sanitizeFilename("logo.png")).toBe("logo.png");
    expect(sanitizeFilename("my-image_v2.jpg")).toBe("my-image_v2.jpg");
  });

  test("replaces invalid characters with underscores", () => {
    expect(sanitizeFilename("my file (1).png")).toBe("my_file__1_.png");
  });

  test("strips directory separators", () => {
    expect(sanitizeFilename("path/to/file.png")).toBe("file.png");
    expect(sanitizeFilename("C:\\Users\\file.png")).toBe("file.png");
  });

  test("returns unnamed for empty result", () => {
    expect(sanitizeFilename("")).toBe("unnamed");
  });
});

describe("validateAssetFile", () => {
  test("accepts valid image types", () => {
    expect(() => validateAssetFile("image/png", 1000, "test.png")).not.toThrow();
    expect(() => validateAssetFile("image/jpeg", 1000, "test.jpg")).not.toThrow();
    expect(() => validateAssetFile("image/gif", 1000, "test.gif")).not.toThrow();
    expect(() => validateAssetFile("image/svg+xml", 1000, "test.svg")).not.toThrow();
    expect(() => validateAssetFile("image/webp", 1000, "test.webp")).not.toThrow();
  });

  test("rejects invalid content types", () => {
    expect(() => validateAssetFile("application/pdf", 1000, "test.pdf")).toThrow(
      /Invalid file type/,
    );
    expect(() => validateAssetFile("text/html", 1000, "test.html")).toThrow(
      /Invalid file type/,
    );
  });

  test("rejects files over 5MB", () => {
    const overLimit = 5 * 1024 * 1024 + 1;
    expect(() => validateAssetFile("image/png", overLimit, "big.png")).toThrow(
      /File too large/,
    );
  });

  test("accepts files exactly at 5MB", () => {
    const atLimit = 5 * 1024 * 1024;
    expect(() => validateAssetFile("image/png", atLimit, "exact.png")).not.toThrow();
  });

  test("rejects filenames with invalid characters", () => {
    expect(() => validateAssetFile("image/png", 1000, "my file.png")).toThrow(
      /Invalid filename/,
    );
  });
});

describe("uploadAsset", () => {
  beforeEach(() => {
    resetGcsState();
    membershipState = null;
  });

  test("uploads file to correct GCS path", async () => {
    membershipState = { role: "editor" };
    const buf = Buffer.from("fake-image-data");
    const result = await uploadAsset("user-1", "proj-1", buf, "logo.png", "image/png");

    expect(gcsState.uploaded).toHaveLength(1);
    expect(gcsState.uploaded[0].path).toBe("assets/proj-1/logo.png");
    expect(gcsState.uploaded[0].contentType).toBe("image/png");
    expect(result.filename).toBe("logo.png");
    expect(result.contentType).toBe("image/png");
    expect(result.size).toBe(buf.length);
    expect(result.url).toContain("test-bucket");
  });

  test("rejects upload for viewer role", async () => {
    membershipState = { role: "viewer" };
    const buf = Buffer.from("data");
    await expect(
      uploadAsset("user-1", "proj-1", buf, "logo.png", "image/png"),
    ).rejects.toThrow(/Insufficient permissions/);
  });

  test("rejects upload for non-member", async () => {
    membershipState = null;
    const buf = Buffer.from("data");
    await expect(
      uploadAsset("user-1", "proj-1", buf, "logo.png", "image/png"),
    ).rejects.toThrow(/do not have access/);
  });

  test("rejects invalid content type", async () => {
    membershipState = { role: "owner" };
    const buf = Buffer.from("data");
    await expect(
      uploadAsset("user-1", "proj-1", buf, "doc.pdf", "application/pdf"),
    ).rejects.toThrow(/Invalid file type/);
  });

  test("sanitizes filenames before upload", async () => {
    membershipState = { role: "editor" };
    const buf = Buffer.from("data");
    const result = await uploadAsset(
      "user-1",
      "proj-1",
      buf,
      "path/my file.png",
      "image/png",
    );
    expect(result.filename).toBe("my_file.png");
    expect(gcsState.uploaded[0].path).toBe("assets/proj-1/my_file.png");
  });
});

describe("listAssets", () => {
  beforeEach(() => {
    resetGcsState();
    membershipState = null;
  });

  test("returns formatted asset list", async () => {
    membershipState = { role: "viewer" };
    gcsState.files = [
      {
        name: "assets/proj-1/logo.png",
        contentType: "image/png",
        size: 1234,
        updated: "2026-01-01T00:00:00Z",
      },
    ];

    const result = await listAssets("user-1", "proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("logo.png");
    expect(result[0].contentType).toBe("image/png");
    expect(result[0].size).toBe(1234);
    expect(result[0].uploadedAt).toBe("2026-01-01T00:00:00Z");
    expect(result[0].url).toContain("assets/proj-1/logo.png");
  });

  test("viewer can list assets", async () => {
    membershipState = { role: "viewer" };
    gcsState.files = [];
    const result = await listAssets("user-1", "proj-1");
    expect(result).toHaveLength(0);
  });

  test("non-member cannot list assets", async () => {
    membershipState = null;
    await expect(listAssets("user-1", "proj-1")).rejects.toThrow(
      /do not have access/,
    );
  });
});

describe("deleteAsset", () => {
  beforeEach(() => {
    resetGcsState();
    membershipState = null;
  });

  test("deletes file from GCS", async () => {
    membershipState = { role: "editor" };
    await deleteAsset("user-1", "proj-1", "logo.png");
    expect(gcsState.deleted).toEqual(["assets/proj-1/logo.png"]);
  });

  test("owner can delete assets", async () => {
    membershipState = { role: "owner" };
    await deleteAsset("user-1", "proj-1", "logo.png");
    expect(gcsState.deleted).toHaveLength(1);
  });

  test("viewer cannot delete assets", async () => {
    membershipState = { role: "viewer" };
    await expect(
      deleteAsset("user-1", "proj-1", "logo.png"),
    ).rejects.toThrow(/Insufficient permissions/);
  });

  test("non-member cannot delete assets", async () => {
    membershipState = null;
    await expect(
      deleteAsset("user-1", "proj-1", "logo.png"),
    ).rejects.toThrow(/do not have access/);
  });
});

describe("rewriteAssetUrls", () => {
  test("rewrites src attributes referencing assets/", () => {
    const html = '<img src="assets/logo.png" alt="Logo">';
    const result = rewriteAssetUrls(html, "proj-1");
    expect(result).toContain(
      "https://storage.googleapis.com/test-bucket/assets/proj-1/logo.png",
    );
    expect(result).not.toContain('src="assets/logo.png"');
  });

  test("rewrites href attributes referencing assets/", () => {
    const html = '<a href="assets/doc.svg">Link</a>';
    const result = rewriteAssetUrls(html, "proj-1");
    expect(result).toContain(
      "https://storage.googleapis.com/test-bucket/assets/proj-1/doc.svg",
    );
  });

  test("handles multiple asset references", () => {
    const html = '<img src="assets/a.png"><img src="assets/b.jpg">';
    const result = rewriteAssetUrls(html, "proj-1");
    expect(result).toContain("assets/proj-1/a.png");
    expect(result).toContain("assets/proj-1/b.jpg");
  });

  test("does not rewrite non-asset URLs", () => {
    const html = '<img src="https://example.com/image.png">';
    const result = rewriteAssetUrls(html, "proj-1");
    expect(result).toBe(html);
  });

  test("handles single and double quotes", () => {
    const html = "<img src='assets/logo.png'>";
    const result = rewriteAssetUrls(html, "proj-1");
    expect(result).toContain("assets/proj-1/logo.png");
  });

  test("returns unchanged html when no assets", () => {
    const html = "<div>No assets here</div>";
    expect(rewriteAssetUrls(html, "proj-1")).toBe(html);
  });
});
