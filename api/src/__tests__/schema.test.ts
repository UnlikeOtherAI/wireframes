import { describe, test, expect } from "bun:test";
import { getTableName } from "drizzle-orm";
import {
  users,
  projects,
  memberships,
  documents,
  previews,
  previewAccess,
  invites,
  chatSessions,
  chatMessages,
  membershipRole,
  inviteRole,
  accessMode,
  chatMessageRole,
} from "../db/schema.js";

describe("enums", () => {
  test("membershipRole has owner, editor, viewer", () => {
    expect(membershipRole.enumValues).toEqual(["owner", "editor", "viewer"]);
  });

  test("inviteRole has editor, viewer", () => {
    expect(inviteRole.enumValues).toEqual(["editor", "viewer"]);
  });

  test("accessMode has public, password, sso", () => {
    expect(accessMode.enumValues).toEqual(["public", "password", "sso"]);
  });

  test("chatMessageRole has user, assistant", () => {
    expect(chatMessageRole.enumValues).toEqual(["user", "assistant"]);
  });
});

describe("users table", () => {
  test("has correct table name", () => {
    expect(getTableName(users)).toBe("users");
  });

  test("has all required columns", () => {
    const columns = Object.keys(users);
    expect(columns).toContain("id");
    expect(columns).toContain("email");
    expect(columns).toContain("displayName");
    expect(columns).toContain("locale");
    expect(columns).toContain("ssoSubject");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  test("email is not nullable", () => {
    expect(users.email.notNull).toBe(true);
  });
});

describe("projects table", () => {
  test("has correct table name", () => {
    expect(getTableName(projects)).toBe("projects");
  });

  test("has all required columns", () => {
    const columns = Object.keys(projects);
    expect(columns).toContain("id");
    expect(columns).toContain("name");
    expect(columns).toContain("ownerId");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  test("name is not nullable", () => {
    expect(projects.name.notNull).toBe(true);
  });

  test("ownerId is not nullable", () => {
    expect(projects.ownerId.notNull).toBe(true);
  });
});

describe("memberships table", () => {
  test("has correct table name", () => {
    expect(getTableName(memberships)).toBe("memberships");
  });

  test("has all required columns", () => {
    const columns = Object.keys(memberships);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("projectId");
    expect(columns).toContain("role");
    expect(columns).toContain("createdAt");
  });

  test("does not have updatedAt (per spec)", () => {
    const columns = Object.keys(memberships);
    expect(columns).not.toContain("updatedAt");
  });
});

describe("documents table", () => {
  test("has correct table name", () => {
    expect(getTableName(documents)).toBe("documents");
  });

  test("has all required columns", () => {
    const columns = Object.keys(documents);
    expect(columns).toContain("id");
    expect(columns).toContain("projectId");
    expect(columns).toContain("documentType");
    expect(columns).toContain("documentId");
    expect(columns).toContain("content");
    expect(columns).toContain("contentHash");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });
});

describe("previews table", () => {
  test("has correct table name", () => {
    expect(getTableName(previews)).toBe("previews");
  });

  test("has all required columns", () => {
    const columns = Object.keys(previews);
    expect(columns).toContain("id");
    expect(columns).toContain("projectId");
    expect(columns).toContain("slug");
    expect(columns).toContain("accessMode");
    expect(columns).toContain("passwordHash");
    expect(columns).toContain("buildUrl");
    expect(columns).toContain("publishedAt");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  test("passwordHash is nullable", () => {
    expect(previews.passwordHash.notNull).toBe(false);
  });
});

describe("previewAccess table", () => {
  test("has correct table name", () => {
    expect(getTableName(previewAccess)).toBe("preview_access");
  });

  test("has all required columns", () => {
    const columns = Object.keys(previewAccess);
    expect(columns).toContain("id");
    expect(columns).toContain("previewId");
    expect(columns).toContain("email");
    expect(columns).toContain("createdAt");
  });

  test("email is not nullable", () => {
    expect(previewAccess.email.notNull).toBe(true);
  });
});

describe("invites table", () => {
  test("has correct table name", () => {
    expect(getTableName(invites)).toBe("invites");
  });

  test("has all required columns", () => {
    const columns = Object.keys(invites);
    expect(columns).toContain("id");
    expect(columns).toContain("projectId");
    expect(columns).toContain("email");
    expect(columns).toContain("role");
    expect(columns).toContain("token");
    expect(columns).toContain("invitedBy");
    expect(columns).toContain("acceptedAt");
    expect(columns).toContain("createdAt");
  });

  test("acceptedAt is nullable", () => {
    expect(invites.acceptedAt.notNull).toBe(false);
  });

  test("email is not nullable", () => {
    expect(invites.email.notNull).toBe(true);
  });

  test("token is not nullable", () => {
    expect(invites.token.notNull).toBe(true);
  });
});

describe("chatSessions table", () => {
  test("has correct table name", () => {
    expect(getTableName(chatSessions)).toBe("chat_sessions");
  });

  test("has all required columns", () => {
    const columns = Object.keys(chatSessions);
    expect(columns).toContain("id");
    expect(columns).toContain("projectId");
    expect(columns).toContain("userId");
    expect(columns).toContain("scope");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
    expect(columns).toContain("expiresAt");
  });

  test("projectId is not nullable", () => {
    expect(chatSessions.projectId.notNull).toBe(true);
  });

  test("userId is not nullable", () => {
    expect(chatSessions.userId.notNull).toBe(true);
  });
});

describe("chatMessages table", () => {
  test("has correct table name", () => {
    expect(getTableName(chatMessages)).toBe("chat_messages");
  });

  test("has all required columns", () => {
    const columns = Object.keys(chatMessages);
    expect(columns).toContain("id");
    expect(columns).toContain("sessionId");
    expect(columns).toContain("role");
    expect(columns).toContain("content");
    expect(columns).toContain("toolCalls");
    expect(columns).toContain("createdAt");
  });

  test("sessionId is not nullable", () => {
    expect(chatMessages.sessionId.notNull).toBe(true);
  });

  test("content is not nullable", () => {
    expect(chatMessages.content.notNull).toBe(true);
  });

  test("toolCalls is nullable", () => {
    expect(chatMessages.toolCalls.notNull).toBe(false);
  });
});
