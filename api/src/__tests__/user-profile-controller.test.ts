import { describe, test, expect, mock, beforeEach } from "bun:test";

let repoState = {
  user: null as any,
  updatedUser: null as any,
  deleteCalled: false,
  pendingInvites: [] as any[],
  invite: null as any,
  inviteDeleted: false,
};

function resetRepo() {
  repoState = {
    user: null,
    updatedUser: null,
    deleteCalled: false,
    pendingInvites: [],
    invite: null,
    inviteDeleted: false,
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

mock.module("../repositories/user-profile.js", () => ({
  findUserById: async () => repoState.user,
  updateUser: async () => repoState.updatedUser,
  deleteUserCascade: async () => {
    repoState.deleteCalled = true;
  },
  findPendingInvitesByEmail: async () => repoState.pendingInvites,
  findInviteById: async () => repoState.invite,
  deleteInvite: async () => {
    repoState.inviteDeleted = true;
  },
}));

import {
  getProfileController,
  updateProfileController,
  deleteAccountController,
  listInvitesController,
  declineInviteController,
} from "../controllers/user-profile.js";
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

const getHandler = errorHandler(auth((r) => getProfileController(r)));
const updateHandler = errorHandler(
  auth((r) => updateProfileController(r)),
);
const deleteHandler = errorHandler(
  auth((r) => deleteAccountController(r)),
);
const listInvitesHandler = errorHandler(
  auth((r) => listInvitesController(r)),
);
const declineHandler = errorHandler(
  auth((r) => declineInviteController(r, "invite-1")),
);

describe("getProfileController", () => {
  beforeEach(resetRepo);

  test("returns user profile", async () => {
    repoState.user = {
      id: "user-1",
      email: "test@example.com",
      displayName: "Test User",
      locale: "en",
      createdAt: new Date("2024-01-01"),
    };

    const res = await getHandler(makeRequest("/users/me", "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("user-1");
    expect(body.email).toBe("test@example.com");
    expect(body.displayName).toBe("Test User");
    expect(body.locale).toBe("en");
  });

  test("returns 401 without auth", async () => {
    const res = await getHandler(
      makeRequest("/users/me", "GET", undefined, { withAuth: false }),
    );
    expect(res.status).toBe(401);
  });

  test("returns 404 if user not found", async () => {
    repoState.user = null;
    const res = await getHandler(makeRequest("/users/me", "GET"));
    expect(res.status).toBe(404);
  });
});

describe("updateProfileController", () => {
  beforeEach(resetRepo);

  test("updates displayName", async () => {
    repoState.user = {
      id: "user-1",
      email: "test@example.com",
      displayName: "Old Name",
      locale: "en",
      createdAt: new Date("2024-01-01"),
    };
    repoState.updatedUser = {
      id: "user-1",
      email: "test@example.com",
      displayName: "New Name",
      locale: "en",
      createdAt: new Date("2024-01-01"),
    };

    const res = await updateHandler(
      makeRequest("/users/me", "PATCH", { displayName: "New Name" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("New Name");
  });

  test("updates locale", async () => {
    repoState.user = {
      id: "user-1",
      email: "test@example.com",
      displayName: "Test",
      locale: "en",
      createdAt: new Date("2024-01-01"),
    };
    repoState.updatedUser = {
      id: "user-1",
      email: "test@example.com",
      displayName: "Test",
      locale: "fr",
      createdAt: new Date("2024-01-01"),
    };

    const res = await updateHandler(
      makeRequest("/users/me", "PATCH", { locale: "fr" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locale).toBe("fr");
  });

  test("returns 400 for empty body", async () => {
    const res = await updateHandler(
      makeRequest("/users/me", "PATCH", {}),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/users/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${testJwt}` },
      body: "not json",
    });
    const res = await updateHandler(req);
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid locale (empty)", async () => {
    const res = await updateHandler(
      makeRequest("/users/me", "PATCH", { locale: "  " }),
    );
    expect(res.status).toBe(400);
  });
});

describe("deleteAccountController", () => {
  beforeEach(resetRepo);

  test("deletes account with correct confirmation header", async () => {
    const res = await deleteHandler(
      makeRequest("/users/me", "DELETE", undefined, {
        headers: { "X-Confirm-Delete": "test@example.com" },
      }),
    );
    expect(res.status).toBe(204);
    expect(repoState.deleteCalled).toBe(true);
  });

  test("returns 400 without confirmation header", async () => {
    const res = await deleteHandler(
      makeRequest("/users/me", "DELETE"),
    );
    expect(res.status).toBe(400);
    expect(repoState.deleteCalled).toBe(false);
  });

  test("returns 400 with wrong confirmation email", async () => {
    const res = await deleteHandler(
      makeRequest("/users/me", "DELETE", undefined, {
        headers: { "X-Confirm-Delete": "wrong@example.com" },
      }),
    );
    expect(res.status).toBe(400);
    expect(repoState.deleteCalled).toBe(false);
  });
});

describe("listInvitesController", () => {
  beforeEach(resetRepo);

  test("returns pending invites", async () => {
    repoState.pendingInvites = [
      {
        id: "inv-1",
        projectId: "p-1",
        projectName: "Project 1",
        role: "editor",
        invitedBy: "user-2",
        createdAt: new Date("2024-01-01"),
        token: "abc123",
      },
    ];

    const res = await listInvitesHandler(
      makeRequest("/users/me/invites", "GET"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].projectName).toBe("Project 1");
    expect(body[0].role).toBe("editor");
  });

  test("returns empty array when no invites", async () => {
    repoState.pendingInvites = [];

    const res = await listInvitesHandler(
      makeRequest("/users/me/invites", "GET"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});

describe("declineInviteController", () => {
  beforeEach(resetRepo);

  test("declines invite and returns 204", async () => {
    repoState.invite = {
      id: "invite-1",
      email: "test@example.com",
    };

    const res = await declineHandler(
      makeRequest("/users/me/invites/invite-1/decline", "POST"),
    );
    expect(res.status).toBe(204);
    expect(repoState.inviteDeleted).toBe(true);
  });

  test("returns 404 for nonexistent invite", async () => {
    repoState.invite = null;

    const res = await declineHandler(
      makeRequest("/users/me/invites/invite-1/decline", "POST"),
    );
    expect(res.status).toBe(404);
  });

  test("returns 403 for invite belonging to different email", async () => {
    repoState.invite = {
      id: "invite-1",
      email: "other@example.com",
    };

    const res = await declineHandler(
      makeRequest("/users/me/invites/invite-1/decline", "POST"),
    );
    expect(res.status).toBe(403);
  });
});
