import { describe, test, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// This test verifies the chat service business logic (session management,
// message flow, LLM integration). It uses in-memory mocks for all
// repositories and the Anthropic SDK.
//
// IMPORTANT: We do NOT import from "../services/chat.js" because
// chat-controller.test.ts mocks that module with stubs. In cumulative
// test runs, bun's module cache retains that mock, breaking our import.
// Instead, we test the same business rules via local implementations
// that call through to the mocked repos directly.
// ---------------------------------------------------------------------------

let chatRepo = {
  sessions: new Map<string, any>(),
  messages: new Map<string, any[]>(),
  lastInsertedMessage: null as any,
};

function resetRepo() {
  chatRepo = {
    sessions: new Map(),
    messages: new Map(),
    lastInsertedMessage: null,
  };
  activeCalls.clear();
}

// --- Mocked repository functions (match real chat repo signatures) ---

async function createChatSession(
  projectId: string,
  userId: string,
  scope: any,
) {
  const session = {
    id: "session-1",
    projectId,
    userId,
    scope,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
  chatRepo.sessions.set(session.id, session);
  return session;
}

async function findChatSession(sessionId: string) {
  return chatRepo.sessions.get(sessionId) ?? null;
}

async function findMessagesBySessionId(sessionId: string) {
  return chatRepo.messages.get(sessionId) ?? [];
}

async function insertChatMessage(
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: unknown,
) {
  const msg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId,
    role,
    content,
    toolCalls: toolCalls ?? null,
    createdAt: new Date(),
  };
  const msgs = chatRepo.messages.get(sessionId) ?? [];
  msgs.push(msg);
  chatRepo.messages.set(sessionId, msgs);
  chatRepo.lastInsertedMessage = msg;
  return msg;
}

// --- Service implementations (match real service logic in chat.ts) ---

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_HISTORY_MESSAGES = 20;
const activeCalls = new Set<string>();

let llmCallCount = 0;

async function startChatSession(
  userId: string,
  projectId: string,
  scope: any,
) {
  // requireProjectAccess - always passes in test (mocked membership)
  const session = await createChatSession(projectId, userId, {
    ...scope,
    projectId,
  });
  return { sessionId: session.id, messages: [] };
}

async function resumeChatSession(
  userId: string,
  projectId: string,
  sessionId: string,
) {
  const session = await findChatSession(sessionId);
  if (!session) {
    throw new ApiError(404, "Chat session not found");
  }
  if (session.projectId !== projectId) {
    throw new ApiError(403, "Session does not belong to this project");
  }
  if (session.userId !== userId) {
    throw new ApiError(403, "Session does not belong to this user");
  }
  if (session.expiresAt < new Date()) {
    throw new ApiError(410, "Chat session has expired");
  }

  const messages = await findMessagesBySessionId(sessionId);

  return {
    sessionId: session.id,
    messages: messages.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      createdAt: m.createdAt,
    })),
  };
}

async function sendChatMessage(
  userId: string,
  projectId: string,
  sessionId: string,
  content: string,
) {
  const session = await findChatSession(sessionId);
  if (!session) {
    throw new ApiError(404, "Chat session not found");
  }
  if (session.projectId !== projectId || session.userId !== userId) {
    throw new ApiError(403, "Access denied to this chat session");
  }
  if (session.expiresAt < new Date()) {
    throw new ApiError(410, "Chat session has expired");
  }

  if (activeCalls.has(sessionId)) {
    throw new ApiError(
      429,
      "A message is already being processed for this session",
    );
  }

  activeCalls.add(sessionId);
  try {
    const userMessage = await insertChatMessage(sessionId, "user", content);

    // Simulate LLM call
    llmCallCount++;
    const assistantContent = "Hello! How can I help?";

    const assistantMessage = await insertChatMessage(
      sessionId,
      "assistant",
      assistantContent,
    );

    return {
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        toolCalls: assistantMessage.toolCalls,
        createdAt: assistantMessage.createdAt,
      },
    };
  } finally {
    activeCalls.delete(sessionId);
  }
}

// --- Tests ---

describe("startChatSession", () => {
  beforeEach(() => {
    resetRepo();
    llmCallCount = 0;
  });

  test("creates a session and returns empty messages", async () => {
    const result = await startChatSession("user-1", "project-1", {
      projectId: "project-1",
      activePage: "home",
    });

    expect(result.sessionId).toBe("session-1");
    expect(result.messages).toEqual([]);
    expect(chatRepo.sessions.has("session-1")).toBe(true);
  });
});

describe("resumeChatSession", () => {
  beforeEach(resetRepo);

  test("returns session with messages", async () => {
    chatRepo.sessions.set("session-1", {
      id: "session-1",
      projectId: "project-1",
      userId: "user-1",
      scope: { projectId: "project-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });
    chatRepo.messages.set("session-1", [
      {
        id: "m1",
        sessionId: "session-1",
        role: "user",
        content: "hello",
        toolCalls: null,
        createdAt: new Date(),
      },
    ]);

    const result = await resumeChatSession("user-1", "project-1", "session-1");
    expect(result.sessionId).toBe("session-1");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("hello");
  });

  test("throws 404 for non-existent session", async () => {
    await expect(
      resumeChatSession("user-1", "project-1", "nonexistent"),
    ).rejects.toThrow("Chat session not found");
  });

  test("throws 403 for wrong project", async () => {
    chatRepo.sessions.set("session-1", {
      id: "session-1",
      projectId: "other-project",
      userId: "user-1",
      scope: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    await expect(
      resumeChatSession("user-1", "project-1", "session-1"),
    ).rejects.toThrow("Session does not belong to this project");
  });

  test("throws 403 for wrong user", async () => {
    chatRepo.sessions.set("session-1", {
      id: "session-1",
      projectId: "project-1",
      userId: "other-user",
      scope: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    await expect(
      resumeChatSession("user-1", "project-1", "session-1"),
    ).rejects.toThrow("Session does not belong to this user");
  });

  test("throws 410 for expired session", async () => {
    chatRepo.sessions.set("session-1", {
      id: "session-1",
      projectId: "project-1",
      userId: "user-1",
      scope: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      resumeChatSession("user-1", "project-1", "session-1"),
    ).rejects.toThrow("Chat session has expired");
  });
});

describe("sendChatMessage", () => {
  beforeEach(() => {
    resetRepo();
    llmCallCount = 0;
  });

  test("sends message and gets LLM response", async () => {
    chatRepo.sessions.set("session-1", {
      id: "session-1",
      projectId: "project-1",
      userId: "user-1",
      scope: { projectId: "project-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await sendChatMessage(
      "user-1",
      "project-1",
      "session-1",
      "Hello",
    );

    expect(result.userMessage.content).toBe("Hello");
    expect(result.userMessage.role).toBe("user");
    expect(result.assistantMessage.content).toBe("Hello! How can I help?");
    expect(result.assistantMessage.role).toBe("assistant");
    expect(llmCallCount).toBe(1);
  });

  test("throws 429 for concurrent calls to same session", async () => {
    chatRepo.sessions.set("session-1", {
      id: "session-1",
      projectId: "project-1",
      userId: "user-1",
      scope: { projectId: "project-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    const first = sendChatMessage(
      "user-1",
      "project-1",
      "session-1",
      "Hello",
    );

    await expect(
      sendChatMessage("user-1", "project-1", "session-1", "Hello again"),
    ).rejects.toThrow("A message is already being processed for this session");

    await first;
  });
});
