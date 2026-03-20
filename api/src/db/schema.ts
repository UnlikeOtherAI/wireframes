import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "editor",
  "viewer",
]);

export const inviteRole = pgEnum("invite_role", ["editor", "viewer"]);

export const chatMessageRole = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

export const accessMode = pgEnum("access_mode", [
  "public",
  "password",
  "sso",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  displayName: text("display_name"),
  locale: text("locale").default("en"),
  ssoSubject: text("sso_subject").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    role: membershipRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.userId, t.projectId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    documentType: text("document_type").notNull(),
    documentId: text("document_id").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.projectId, t.documentType, t.documentId)],
);

export const previews = pgTable("previews", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  slug: text("slug").unique().notNull(),
  accessMode: accessMode("access_mode").notNull(),
  passwordHash: text("password_hash"),
  buildUrl: text("build_url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const previewAccess = pgTable(
  "preview_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    previewId: uuid("preview_id")
      .references(() => previews.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.previewId, t.email)],
);

export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  role: inviteRole("role").notNull(),
  token: text("token").unique().notNull(),
  invitedBy: uuid("invited_by")
    .references(() => users.id)
    .notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  scope: jsonb("scope").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '30 days'`),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => chatSessions.id, { onDelete: "cascade" })
    .notNull(),
  role: chatMessageRole("role").notNull(),
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
