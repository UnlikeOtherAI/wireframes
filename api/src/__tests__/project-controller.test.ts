import { describe, test, expect, mock } from "bun:test";

let repoState = {
  membership: null as { role: string } | null,
  projects: [] as any[],
  project: null as any,
  memberCount: 0,
  documentCount: 0,
  createdProject: null as any,
  updatedProject: null as any,
  deleteCalled: false,
};

function resetRepo() {
  repoState = {
    membership: null,
    projects: [],
    project: null,
    memberCount: 0,
    documentCount: 0,
    createdProject: null,
    updatedProject: null,
    deleteCalled: false,
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
  findProjectsByUserId: async () => repoState.projects,
  findProjectById: async () => repoState.project,
  countMembers: async () => repoState.memberCount,
  countDocuments: async () => repoState.documentCount,
  createProjectWithOwner: async () => repoState.createdProject,
  updateProject: async () => repoState.updatedProject,
  deleteProject: async () => {
    repoState.deleteCalled = true;
  },
}));

import {
  listProjectsController,
  createProjectController,
  getProjectController,
  updateProjectController,
  deleteProjectController,
} from "../controllers/project.js";
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
  withAuth = true,
): Request {
  const headers: Record<string, string> = {};
  if (withAuth) headers["Authorization"] = `Bearer ${testJwt}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}

const listHandler = errorHandler(auth((r) => listProjectsController(r)));
const createHandler = errorHandler(auth((r) => createProjectController(r)));
const getHandler = errorHandler(
  auth((r) => getProjectController(r, "project-1")),
);
const updateHandler = errorHandler(
  auth((r) => updateProjectController(r, "project-1")),
);
const deleteHandler = errorHandler(
  auth((r) => deleteProjectController(r, "project-1")),
);

describe("listProjectsController", () => {
  test("returns list of projects", async () => {
    resetRepo();
    repoState.projects = [{ id: "p1", name: "Project 1", role: "owner" }];

    const res = await listHandler(makeRequest("/projects", "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Project 1");
  });

  test("returns 401 without auth", async () => {
    const res = await listHandler(
      makeRequest("/projects", "GET", undefined, false),
    );
    expect(res.status).toBe(401);
  });
});

describe("createProjectController", () => {
  test("creates project and returns 201", async () => {
    resetRepo();
    repoState.createdProject = { id: "p1", name: "New Project" };

    const res = await createHandler(
      makeRequest("/projects", "POST", { name: "New Project" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("New Project");
  });

  test("returns 400 for missing name", async () => {
    resetRepo();
    const res = await createHandler(makeRequest("/projects", "POST", {}));
    expect(res.status).toBe(400);
  });

  test("returns 400 for empty name", async () => {
    resetRepo();
    const res = await createHandler(
      makeRequest("/projects", "POST", { name: "  " }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${testJwt}` },
      body: "not json",
    });
    const res = await createHandler(req);
    expect(res.status).toBe(400);
  });
});

describe("getProjectController", () => {
  test("returns project details with counts", async () => {
    resetRepo();
    repoState.membership = { role: "owner" };
    repoState.project = { id: "project-1", name: "Test" };
    repoState.memberCount = 2;
    repoState.documentCount = 5;

    const res = await getHandler(makeRequest("/projects/project-1", "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memberCount).toBe(2);
    expect(body.documentCount).toBe(5);
    expect(body.role).toBe("owner");
  });

  test("returns 403 for non-member", async () => {
    resetRepo();
    repoState.membership = null;

    const res = await getHandler(makeRequest("/projects/project-1", "GET"));
    expect(res.status).toBe(403);
  });
});

describe("updateProjectController", () => {
  test("updates project name for editor", async () => {
    resetRepo();
    repoState.membership = { role: "editor" };
    repoState.updatedProject = { id: "project-1", name: "Updated" };

    const res = await updateHandler(
      makeRequest("/projects/project-1", "PATCH", { name: "Updated" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated");
  });

  test("returns 403 for viewer", async () => {
    resetRepo();
    repoState.membership = { role: "viewer" };

    const res = await updateHandler(
      makeRequest("/projects/project-1", "PATCH", { name: "Updated" }),
    );
    expect(res.status).toBe(403);
  });

  test("returns 400 for empty name", async () => {
    resetRepo();
    repoState.membership = { role: "editor" };

    const res = await updateHandler(
      makeRequest("/projects/project-1", "PATCH", { name: "" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("deleteProjectController", () => {
  test("returns 204 for owner", async () => {
    resetRepo();
    repoState.membership = { role: "owner" };

    const res = await deleteHandler(
      makeRequest("/projects/project-1", "DELETE"),
    );
    expect(res.status).toBe(204);
    expect(repoState.deleteCalled).toBe(true);
  });

  test("returns 403 for editor", async () => {
    resetRepo();
    repoState.membership = { role: "editor" };

    const res = await deleteHandler(
      makeRequest("/projects/project-1", "DELETE"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 403 for viewer", async () => {
    resetRepo();
    repoState.membership = { role: "viewer" };

    const res = await deleteHandler(
      makeRequest("/projects/project-1", "DELETE"),
    );
    expect(res.status).toBe(403);
  });
});
