import { describe, test, expect, mock, beforeEach } from "bun:test";

let repoState = {
  projectMembership: null as { role: string } | null,
  members: [] as any[],
  userByEmail: null as { id: string; email: string } | null,
  membershipByUserAndProject: null as { role: string } | null,
  pendingInvite: null as any,
  createdInvite: null as any,
  inviteByToken: null as any,
  project: null as any,
  acceptInviteCalled: false,
  updateRoleCalled: false,
  updateRoleArgs: null as any,
  transferCalled: false,
  transferArgs: null as any,
  removeCalled: false,
  removeArgs: null as any,
};

function resetRepo() {
  repoState = {
    projectMembership: null,
    members: [],
    userByEmail: null,
    membershipByUserAndProject: null,
    pendingInvite: null,
    createdInvite: null,
    inviteByToken: null,
    project: null,
    acceptInviteCalled: false,
    updateRoleCalled: false,
    updateRoleArgs: null,
    transferCalled: false,
    transferArgs: null,
    removeCalled: false,
    removeArgs: null,
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
  findMembership: async () => repoState.projectMembership,
  findProjectsByUserId: async () => [],
  findProjectById: async () => repoState.project,
  countMembers: async () => 0,
  countDocuments: async () => 0,
  createProjectWithOwner: async () => null,
  updateProject: async () => null,
  deleteProject: async () => {},
}));

mock.module("../repositories/membership.js", () => ({
  findMembersByProjectId: async () => repoState.members,
  findUserByEmail: async () => repoState.userByEmail,
  findMembershipByUserAndProject: async () =>
    repoState.membershipByUserAndProject,
  findPendingInviteByProjectAndEmail: async () => repoState.pendingInvite,
  createInvite: async () => repoState.createdInvite,
  findInviteByToken: async () => repoState.inviteByToken,
  acceptInvite: async () => {
    repoState.acceptInviteCalled = true;
  },
  updateMemberRole: async (...args: any[]) => {
    repoState.updateRoleCalled = true;
    repoState.updateRoleArgs = args;
  },
  transferOwnership: async (...args: any[]) => {
    repoState.transferCalled = true;
    repoState.transferArgs = args;
  },
  removeMembership: async (...args: any[]) => {
    repoState.removeCalled = true;
    repoState.removeArgs = args;
  },
  findProjectById: async () => repoState.project,
}));

import {
  changeMemberRoleController,
  removeMemberController,
} from "../controllers/membership.js";
import { errorHandler } from "../middleware/error-handler.js";
import { auth } from "../middleware/auth.js";
import { signJwt } from "../services/jwt.js";

const testJwt = signJwt(
  { userId: "user-1", email: "owner@example.com" },
  "test-secret",
);

function makeRequest(
  path: string,
  method: string,
  body?: unknown,
  token = testJwt,
): Request {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}

const changeRoleHandler = errorHandler(
  auth((r) => changeMemberRoleController(r, "project-1", "user-2")),
);
const removeHandler = errorHandler(
  auth((r) => removeMemberController(r, "project-1", "user-2")),
);

beforeEach(() => {
  resetRepo();
});

describe("changeMemberRoleController", () => {
  test("changes role to editor", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.membershipByUserAndProject = { role: "viewer" };

    const res = await changeRoleHandler(
      makeRequest("/projects/project-1/members/user-2", "PATCH", {
        role: "editor",
      }),
    );
    expect(res.status).toBe(200);
    expect(repoState.updateRoleCalled).toBe(true);
    const body = await res.json();
    expect(body.role).toBe("editor");
  });

  test("transfers ownership when role is owner", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.membershipByUserAndProject = { role: "editor" };

    const res = await changeRoleHandler(
      makeRequest("/projects/project-1/members/user-2", "PATCH", {
        role: "owner",
      }),
    );
    expect(res.status).toBe(200);
    expect(repoState.transferCalled).toBe(true);
    expect(repoState.transferArgs).toEqual(["project-1", "user-1", "user-2"]);
  });

  test("returns 400 when trying to change own role", async () => {
    repoState.projectMembership = { role: "owner" };

    const selfHandler = errorHandler(
      auth((r) => changeMemberRoleController(r, "project-1", "user-1")),
    );
    const res = await selfHandler(
      makeRequest("/projects/project-1/members/user-1", "PATCH", {
        role: "editor",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 403 for non-owner", async () => {
    repoState.projectMembership = { role: "editor" };

    const res = await changeRoleHandler(
      makeRequest("/projects/project-1/members/user-2", "PATCH", {
        role: "viewer",
      }),
    );
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent member", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.membershipByUserAndProject = null;

    const res = await changeRoleHandler(
      makeRequest("/projects/project-1/members/user-2", "PATCH", {
        role: "editor",
      }),
    );
    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid role", async () => {
    repoState.projectMembership = { role: "owner" };

    const res = await changeRoleHandler(
      makeRequest("/projects/project-1/members/user-2", "PATCH", {
        role: "admin",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON body", async () => {
    repoState.projectMembership = { role: "owner" };

    const req = new Request(
      "http://localhost/projects/project-1/members/user-2",
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${testJwt}` },
        body: "not json",
      },
    );
    const res = await changeRoleHandler(req);
    expect(res.status).toBe(400);
  });
});

describe("removeMemberController", () => {
  test("removes member and returns 204", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.membershipByUserAndProject = { role: "editor" };

    const res = await removeHandler(
      makeRequest("/projects/project-1/members/user-2", "DELETE"),
    );
    expect(res.status).toBe(204);
    expect(repoState.removeCalled).toBe(true);
  });

  test("returns 400 when trying to remove self", async () => {
    repoState.projectMembership = { role: "owner" };

    const selfHandler = errorHandler(
      auth((r) => removeMemberController(r, "project-1", "user-1")),
    );
    const res = await selfHandler(
      makeRequest("/projects/project-1/members/user-1", "DELETE"),
    );
    expect(res.status).toBe(400);
  });

  test("returns 403 for non-owner", async () => {
    repoState.projectMembership = { role: "editor" };

    const res = await removeHandler(
      makeRequest("/projects/project-1/members/user-2", "DELETE"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 403 for viewer", async () => {
    repoState.projectMembership = { role: "viewer" };

    const res = await removeHandler(
      makeRequest("/projects/project-1/members/user-2", "DELETE"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent member", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.membershipByUserAndProject = null;

    const res = await removeHandler(
      makeRequest("/projects/project-1/members/user-2", "DELETE"),
    );
    expect(res.status).toBe(404);
  });
});
