import { describe, test, expect, mock, beforeEach } from "bun:test";

let repoState = {
  membership: null as { role: string } | null,
  documents: [] as any[],
  document: null as any,
  upsertResult: { conflict: false },
  deleteResult: true,
  upsertCalled: false,
  deleteCalled: false,
};

let engineState = {
  validateResult: null as { documentType: string; specVersion: string; id: string } | null,
  validateError: null as Error | null,
};

function resetState() {
  repoState = {
    membership: null,
    documents: [],
    document: null,
    upsertResult: { conflict: false },
    deleteResult: true,
    upsertCalled: false,
    deleteCalled: false,
  };
  engineState = {
    validateResult: null,
    validateError: null,
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
  listDocuments: async () => repoState.documents,
  findDocument: async () => repoState.document,
  findDocumentsByProjectId: async () => [],
  upsertDocument: async () => {
    repoState.upsertCalled = true;
    return repoState.upsertResult;
  },
  deleteDocument: async () => {
    repoState.deleteCalled = true;
    return repoState.deleteResult;
  },
}));

mock.module("../services/engine.js", () => ({
  validateProject: () => ({ ok: true, errors: [], warnings: [] }),
  buildProject: () => ({ ok: true, pages: [], css: "", js: "", routeTable: {}, indexHtml: "", platformIndexes: {} }),
  validateDocument: (doc: any, label: string) => {
    if (engineState.validateError) throw engineState.validateError;
    if (engineState.validateResult) return engineState.validateResult;
    return { documentType: doc.documentType, specVersion: String(doc.specVersion), id: doc.id };
  },
  SchemaLoadError: class SchemaLoadError extends Error {
    code: string;
    details?: object;
    constructor(message: string, code: string, details?: object) {
      super(message);
      this.name = "SchemaLoadError";
      this.code = code;
      this.details = details;
    }
  },
}));

import {
  listDocumentsController,
  getDocumentController,
  upsertDocumentController,
  deleteDocumentController,
} from "../controllers/document.js";
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
  body?: unknown,
  options?: { withAuth?: boolean; headers?: Record<string, string> },
): Request {
  const { withAuth = true, headers: extraHeaders = {} } = options ?? {};
  const headers: Record<string, string> = { ...extraHeaders };
  if (withAuth) headers["Authorization"] = `Bearer ${testJwt}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}

const listHandler = errorHandler(
  auth((r) => listDocumentsController(r, "project-1")),
);
const getHandler = errorHandler(
  auth((r) => getDocumentController(r, "project-1", "page", "home")),
);
const upsertHandler = errorHandler(
  auth((r) => upsertDocumentController(r, "project-1", "page")),
);
const deleteHandler = errorHandler(
  auth((r) => deleteDocumentController(r, "project-1", "page", "home")),
);

beforeEach(resetState);

describe("listDocumentsController", () => {
  test("returns document list for member", async () => {
    repoState.membership = { role: "viewer" };
    repoState.documents = [
      { id: "d1", documentType: "page", documentId: "home", contentHash: "abc", updatedAt: new Date() },
    ];

    const res = await listHandler(makeRequest("/projects/project-1/documents", "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].documentId).toBe("home");
  });

  test("returns 403 for non-member", async () => {
    repoState.membership = null;
    const res = await listHandler(makeRequest("/projects/project-1/documents", "GET"));
    expect(res.status).toBe(403);
  });

  test("returns 401 without auth", async () => {
    const res = await listHandler(
      makeRequest("/projects/project-1/documents", "GET", undefined, { withAuth: false }),
    );
    expect(res.status).toBe(401);
  });
});

describe("getDocumentController", () => {
  test("returns document for member", async () => {
    repoState.membership = { role: "viewer" };
    repoState.document = {
      id: "d1",
      documentType: "page",
      documentId: "home",
      content: "id: home\n",
      contentHash: "abc",
      updatedAt: new Date(),
    };

    const res = await getHandler(
      makeRequest("/projects/project-1/documents/page/home", "GET"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe("id: home\n");
  });

  test("returns 404 for missing document", async () => {
    repoState.membership = { role: "viewer" };
    repoState.document = null;

    const res = await getHandler(
      makeRequest("/projects/project-1/documents/page/home", "GET"),
    );
    expect(res.status).toBe(404);
  });

  test("returns 403 for non-member", async () => {
    repoState.membership = null;
    const res = await getHandler(
      makeRequest("/projects/project-1/documents/page/home", "GET"),
    );
    expect(res.status).toBe(403);
  });
});

describe("upsertDocumentController", () => {
  const validYaml = "id: home\ndocumentType: page\nspecVersion: '1.1'\npage:\n  title: Home\n";

  test("upserts valid document for editor", async () => {
    repoState.membership = { role: "editor" };
    repoState.document = {
      id: "d1",
      documentType: "page",
      documentId: "home",
      content: validYaml,
      contentHash: "newhash",
      updatedAt: new Date(),
    };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: validYaml,
      }),
    );
    expect(res.status).toBe(200);
    expect(repoState.upsertCalled).toBe(true);
    const body = await res.json();
    expect(body.documentId).toBe("home");
  });

  test("upserts valid document for owner", async () => {
    repoState.membership = { role: "owner" };
    repoState.document = {
      id: "d1",
      documentType: "page",
      documentId: "home",
      content: validYaml,
      contentHash: "newhash",
      updatedAt: new Date(),
    };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: validYaml,
      }),
    );
    expect(res.status).toBe(200);
  });

  test("returns 403 for viewer", async () => {
    repoState.membership = { role: "viewer" };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: validYaml,
      }),
    );
    expect(res.status).toBe(403);
  });

  test("returns 400 for missing documentId", async () => {
    repoState.membership = { role: "editor" };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        content: validYaml,
      }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing content", async () => {
    repoState.membership = { role: "editor" };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON body", async () => {
    repoState.membership = { role: "editor" };

    const req = new Request("http://localhost/projects/project-1/documents/page", {
      method: "PUT",
      headers: { Authorization: `Bearer ${testJwt}` },
      body: "not json",
    });
    const res = await upsertHandler(req);
    expect(res.status).toBe(400);
  });

  test("returns 422 for malformed YAML", async () => {
    repoState.membership = { role: "editor" };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: ":\n  - :\n  invalid: [",
      }),
    );
    expect(res.status).toBe(422);
  });

  test("returns 422 for unknown document type", async () => {
    repoState.membership = { role: "editor" };

    const unknownTypeHandler = errorHandler(
      auth((r) => upsertDocumentController(r, "project-1", "unknown")),
    );
    const res = await unknownTypeHandler(
      makeRequest("/projects/project-1/documents/unknown", "PUT", {
        documentId: "test",
        content: "id: test\n",
      }),
    );
    expect(res.status).toBe(422);
  });

  test("returns 422 when engine schema validation fails", async () => {
    repoState.membership = { role: "editor" };
    const schemaError = new Error("Schema validation failed");
    Object.defineProperty(schemaError, "constructor", {
      value: { name: "SchemaLoadError" },
    });
    (schemaError as any).name = "SchemaLoadError";
    (schemaError as any).code = "SCHEMA_VALIDATION";
    (schemaError as any).details = {
      errors: [{ code: "SCHEMA_TYPE", path: "$.page", message: "Expected object" }],
    };
    engineState.validateError = schemaError;

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: "id: home\ndocumentType: page\nspecVersion: '1.1'\n",
      }),
    );
    expect(res.status).toBe(422);
    expect(repoState.upsertCalled).toBe(false);
  });

  test("returns 422 when YAML id does not match documentId", async () => {
    repoState.membership = { role: "editor" };
    engineState.validateResult = {
      documentType: "page",
      specVersion: "1.1",
      id: "about",
    };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: "id: about\ndocumentType: page\nspecVersion: '1.1'\npage:\n  title: About\n",
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.details).toBeArray();
    expect(body.details[0].path).toBe("id");
    expect(repoState.upsertCalled).toBe(false);
  });

  test("returns 422 when YAML documentType does not match URL", async () => {
    repoState.membership = { role: "editor" };
    engineState.validateResult = {
      documentType: "manifest",
      specVersion: "1.1",
      id: "home",
    };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: "id: home\ndocumentType: manifest\nspecVersion: '1.1'\n",
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.details[0].path).toBe("documentType");
    expect(repoState.upsertCalled).toBe(false);
  });

  test("returns 409 when If-Match header has stale hash", async () => {
    repoState.membership = { role: "editor" };
    repoState.upsertResult = { conflict: true };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: validYaml,
      }, { headers: { "If-Match": "stale-hash" } }),
    );
    expect(res.status).toBe(409);
  });

  test("returns 422 when YAML is a scalar not an object", async () => {
    repoState.membership = { role: "editor" };

    const res = await upsertHandler(
      makeRequest("/projects/project-1/documents/page", "PUT", {
        documentId: "home",
        content: "just a string",
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe("deleteDocumentController", () => {
  test("deletes document for editor", async () => {
    repoState.membership = { role: "editor" };
    repoState.deleteResult = true;

    const res = await deleteHandler(
      makeRequest("/projects/project-1/documents/page/home", "DELETE"),
    );
    expect(res.status).toBe(204);
    expect(repoState.deleteCalled).toBe(true);
  });

  test("deletes document for owner", async () => {
    repoState.membership = { role: "owner" };
    repoState.deleteResult = true;

    const res = await deleteHandler(
      makeRequest("/projects/project-1/documents/page/home", "DELETE"),
    );
    expect(res.status).toBe(204);
  });

  test("returns 403 for viewer", async () => {
    repoState.membership = { role: "viewer" };

    const res = await deleteHandler(
      makeRequest("/projects/project-1/documents/page/home", "DELETE"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 404 for missing document", async () => {
    repoState.membership = { role: "editor" };
    repoState.deleteResult = false;

    const res = await deleteHandler(
      makeRequest("/projects/project-1/documents/page/home", "DELETE"),
    );
    expect(res.status).toBe(404);
  });

  test("returns 403 for non-member", async () => {
    repoState.membership = null;

    const res = await deleteHandler(
      makeRequest("/projects/project-1/documents/page/home", "DELETE"),
    );
    expect(res.status).toBe(403);
  });
});
