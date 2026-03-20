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
  listMembersController,
  sendInviteController,
  acceptInviteController,
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

function makeUnauthRequest(
  path: string,
  method: string,
  body?: unknown,
): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}

const listHandler = errorHandler(
  auth((r) => listMembersController(r, "project-1")),
);
const inviteHandler = errorHandler(
  auth((r) => sendInviteController(r, "project-1")),
);
const acceptHandler = errorHandler(
  auth((r) => acceptInviteController(r, "a".repeat(64))),
);

beforeEach(() => {
  resetRepo();
});

describe("listMembersController", () => {
  test("returns members list", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.members = [
      {
        userId: "user-1",
        email: "owner@example.com",
        displayName: "Owner",
        role: "owner",
        joinedAt: new Date(),
      },
    ];

    const res = await listHandler(
      makeRequest("/projects/project-1/members", "GET"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].role).toBe("owner");
  });

  test("returns 403 for non-member", async () => {
    repoState.projectMembership = null;

    const res = await listHandler(
      makeRequest("/projects/project-1/members", "GET"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 401 without auth", async () => {
    const res = await listHandler(
      makeUnauthRequest("/projects/project-1/members", "GET"),
    );
    expect(res.status).toBe(401);
  });
});

describe("sendInviteController", () => {
  test("creates invite and returns 201", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.userByEmail = null;
    repoState.pendingInvite = null;
    repoState.createdInvite = {
      id: "invite-1",
      projectId: "project-1",
      email: "new@example.com",
      role: "editor",
      token: "a".repeat(64),
      invitedBy: "user-1",
      createdAt: new Date(),
    };

    const res = await inviteHandler(
      makeRequest("/projects/project-1/invite", "POST", {
        email: "new@example.com",
        role: "editor",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("new@example.com");
    expect(body.token).toBeTruthy();
  });

  test("returns 403 for non-owner", async () => {
    repoState.projectMembership = { role: "editor" };

    const res = await inviteHandler(
      makeRequest("/projects/project-1/invite", "POST", {
        email: "new@example.com",
        role: "editor",
      }),
    );
    expect(res.status).toBe(403);
  });

  test("returns 409 if user is already a member", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.userByEmail = { id: "user-3", email: "existing@example.com" };
    repoState.membershipByUserAndProject = { role: "viewer" };

    const res = await inviteHandler(
      makeRequest("/projects/project-1/invite", "POST", {
        email: "existing@example.com",
        role: "editor",
      }),
    );
    expect(res.status).toBe(409);
  });

  test("returns 409 for mixed-case email of existing member", async () => {
    repoState.projectMembership = { role: "owner" };
    repoState.userByEmail = {
      id: "user-3",
      email: "User@Example.COM",
    };
    repoState.membershipByUserAndProject = { role: "viewer" };

    const res = await inviteHandler(
      makeRequest("/projects/project-1/invite", "POST", {
        email: "user@example.com",
        role: "editor",
      }),
    );
    expect(res.status).toBe(409);
  });

  test("returns 400 for missing email", async () => {
    repoState.projectMembership = { role: "owner" };

    const res = await inviteHandler(
      makeRequest("/projects/project-1/invite", "POST", { role: "editor" }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid role", async () => {
    repoState.projectMembership = { role: "owner" };

    const res = await inviteHandler(
      makeRequest("/projects/project-1/invite", "POST", {
        email: "new@example.com",
        role: "owner",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON body", async () => {
    repoState.projectMembership = { role: "owner" };

    const req = new Request("http://localhost/projects/project-1/invite", {
      method: "POST",
      headers: { Authorization: `Bearer ${testJwt}` },
      body: "not json",
    });
    const res = await inviteHandler(req);
    expect(res.status).toBe(400);
  });
});

describe("acceptInviteController", () => {
  test("accepts invite and returns project", async () => {
    repoState.inviteByToken = {
      id: "invite-1",
      projectId: "project-1",
      email: "owner@example.com",
      role: "editor",
      token: "a".repeat(64),
      acceptedAt: null,
    };
    repoState.membershipByUserAndProject = null;
    repoState.project = { id: "project-1", name: "Test Project" };

    const res = await acceptHandler(
      makeRequest(`/invites/${"a".repeat(64)}/accept`, "POST"),
    );
    expect(res.status).toBe(200);
    expect(repoState.acceptInviteCalled).toBe(true);
    const body = await res.json();
    expect(body.name).toBe("Test Project");
  });

  test("returns 403 for email mismatch", async () => {
    repoState.inviteByToken = {
      id: "invite-1",
      projectId: "project-1",
      email: "different@example.com",
      role: "editor",
      token: "a".repeat(64),
      acceptedAt: null,
    };

    const res = await acceptHandler(
      makeRequest(`/invites/${"a".repeat(64)}/accept`, "POST"),
    );
    expect(res.status).toBe(403);
  });

  test("returns 404 for invalid token", async () => {
    repoState.inviteByToken = null;

    const res = await acceptHandler(
      makeRequest(`/invites/${"a".repeat(64)}/accept`, "POST"),
    );
    expect(res.status).toBe(404);
  });

  test("returns 400 for already accepted invite", async () => {
    repoState.inviteByToken = {
      id: "invite-1",
      projectId: "project-1",
      email: "owner@example.com",
      role: "editor",
      token: "a".repeat(64),
      acceptedAt: new Date(),
    };

    const res = await acceptHandler(
      makeRequest(`/invites/${"a".repeat(64)}/accept`, "POST"),
    );
    expect(res.status).toBe(400);
  });
});
