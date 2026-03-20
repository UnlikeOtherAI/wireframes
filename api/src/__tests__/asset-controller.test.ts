import { describe, test, expect, mock, beforeEach } from "bun:test";

let membershipState: { role: string } | null = null;
let gcsState = {
  uploaded: [] as Array<{ path: string; buffer: Buffer; contentType: string }>,
  files: [] as Array<{ name: string; contentType: string; size: number; updated: string }>,
  deleted: [] as string[],
};

function resetState() {
  membershipState = null;
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
  findMembership: async () => membershipState,
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
  listFiles: async () => gcsState.files,
  deleteFile: async (path: string) => {
    gcsState.deleted.push(path);
  },
  getPublicUrl: (path: string) =>
    `https://storage.googleapis.com/test-bucket/${path}`,
}));

import {
  uploadAssetController,
  listAssetsController,
  deleteAssetController,
} from "../controllers/asset.js";
import { errorHandler } from "../middleware/error-handler.js";
import { auth } from "../middleware/auth.js";
import { signJwt } from "../services/jwt.js";

const testJwt = signJwt(
  { userId: "user-1", email: "test@example.com" },
  "test-secret",
);

const projectId = "00000000-0000-0000-0000-000000000001";

function makeUploadHandler() {
  return errorHandler(auth((r) => uploadAssetController(r, projectId)));
}

function makeListHandler() {
  return errorHandler(auth((r) => listAssetsController(r, projectId)));
}

function makeDeleteHandler(filename: string) {
  return errorHandler(
    auth((r) => deleteAssetController(r, projectId, filename)),
  );
}

function authedHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${testJwt}` };
}

describe("uploadAssetController", () => {
  beforeEach(resetState);

  test("returns 401 without auth", async () => {
    const handler = makeUploadHandler();
    const res = await handler(
      new Request("http://localhost/projects/p/assets", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  test("returns 400 for missing file", async () => {
    membershipState = { role: "editor" };
    const handler = makeUploadHandler();
    const formData = new FormData();
    const res = await handler(
      new Request("http://localhost/projects/p/assets", {
        method: "POST",
        headers: authedHeaders(),
        body: formData,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing file");
  });

  test("returns 201 with valid upload", async () => {
    membershipState = { role: "editor" };
    const handler = makeUploadHandler();
    const formData = new FormData();
    const blob = new Blob(["fake-png-data"], { type: "image/png" });
    formData.append("file", blob, "logo.png");

    const res = await handler(
      new Request("http://localhost/projects/p/assets", {
        method: "POST",
        headers: authedHeaders(),
        body: formData,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.filename).toBe("logo.png");
    expect(body.contentType).toBe("image/png");
    expect(body.size).toBe(13);
    expect(body.url).toContain("test-bucket");
  });

  test("returns 403 for viewer upload attempt", async () => {
    membershipState = { role: "viewer" };
    const handler = makeUploadHandler();
    const formData = new FormData();
    const blob = new Blob(["data"], { type: "image/png" });
    formData.append("file", blob, "logo.png");

    const res = await handler(
      new Request("http://localhost/projects/p/assets", {
        method: "POST",
        headers: authedHeaders(),
        body: formData,
      }),
    );
    expect(res.status).toBe(403);
  });

  test("returns 400 for invalid file type", async () => {
    membershipState = { role: "editor" };
    const handler = makeUploadHandler();
    const formData = new FormData();
    const blob = new Blob(["data"], { type: "application/pdf" });
    formData.append("file", blob, "doc.pdf");

    const res = await handler(
      new Request("http://localhost/projects/p/assets", {
        method: "POST",
        headers: authedHeaders(),
        body: formData,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid file type");
  });
});

describe("listAssetsController", () => {
  beforeEach(resetState);

  test("returns 401 without auth", async () => {
    const handler = makeListHandler();
    const res = await handler(
      new Request("http://localhost/projects/p/assets"),
    );
    expect(res.status).toBe(401);
  });

  test("returns asset list for member", async () => {
    membershipState = { role: "viewer" };
    gcsState.files = [
      {
        name: `assets/${projectId}/logo.png`,
        contentType: "image/png",
        size: 5000,
        updated: "2026-01-15T12:00:00Z",
      },
    ];

    const handler = makeListHandler();
    const res = await handler(
      new Request("http://localhost/projects/p/assets", {
        headers: authedHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].filename).toBe("logo.png");
    expect(body[0].contentType).toBe("image/png");
    expect(body[0].size).toBe(5000);
  });
});

describe("deleteAssetController", () => {
  beforeEach(resetState);

  test("returns 401 without auth", async () => {
    const handler = makeDeleteHandler("logo.png");
    const res = await handler(
      new Request("http://localhost/projects/p/assets/logo.png", {
        method: "DELETE",
      }),
    );
    expect(res.status).toBe(401);
  });

  test("returns 204 on successful delete", async () => {
    membershipState = { role: "editor" };
    const handler = makeDeleteHandler("logo.png");
    const res = await handler(
      new Request("http://localhost/projects/p/assets/logo.png", {
        method: "DELETE",
        headers: authedHeaders(),
      }),
    );
    expect(res.status).toBe(204);
    expect(gcsState.deleted).toEqual([`assets/${projectId}/logo.png`]);
  });

  test("returns 403 for viewer delete attempt", async () => {
    membershipState = { role: "viewer" };
    const handler = makeDeleteHandler("logo.png");
    const res = await handler(
      new Request("http://localhost/projects/p/assets/logo.png", {
        method: "DELETE",
        headers: authedHeaders(),
      }),
    );
    expect(res.status).toBe(403);
  });
});
