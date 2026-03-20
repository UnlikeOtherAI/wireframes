import { eq, asc, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { chatSessions, chatMessages } from "../db/schema.js";
import type {
  ChatSessionScope,
  ChatSessionRow,
  ChatMessageRow,
} from "../services/chat-types.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createChatSession(
  projectId: string,
  userId: string,
  scope: ChatSessionScope,
): Promise<ChatSessionRow> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const [row] = await db
    .insert(chatSessions)
    .values({ projectId, userId, scope, expiresAt })
    .returning();
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    scope: row.scope as ChatSessionScope,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
  };
}

export async function findChatSession(
  sessionId: string,
): Promise<ChatSessionRow | null> {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    scope: row.scope as ChatSessionScope,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
  };
}

export async function updateSessionScope(
  sessionId: string,
  scope: ChatSessionScope,
): Promise<void> {
  await db
    .update(chatSessions)
    .set({ scope, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function findMessagesBySessionId(
  sessionId: string,
): Promise<ChatMessageRow[]> {
  const rows = await db
    .select({
      id: chatMessages.id,
      sessionId: chatMessages.sessionId,
      role: chatMessages.role,
      content: chatMessages.content,
      toolCalls: chatMessages.toolCalls,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
  return rows as ChatMessageRow[];
}

export async function insertChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
): Promise<ChatMessageRow> {
  const [row] = await db
    .insert(chatMessages)
    .values({ sessionId, role, content, toolCalls: toolCalls ?? null })
    .returning();
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    toolCalls: row.toolCalls,
    createdAt: row.createdAt,
  };
}

export async function deleteExpiredSessions(): Promise<void> {
  await db
    .delete(chatSessions)
    .where(lt(chatSessions.expiresAt, new Date()));
}
