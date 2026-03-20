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
  membershipRole,
  inviteRole,
  accessMode,
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
