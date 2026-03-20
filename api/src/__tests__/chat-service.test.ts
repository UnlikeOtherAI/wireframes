import { describe, test, expect, mock, beforeEach } from "bun:test";

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
}

mock.module("../repositories/chat.js", () => ({
  createChatSession: async (
    projectId: string,
    userId: string,
    scope: any,
  ) => {
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
  },
  findChatSession: async (sessionId: string) => {
    return chatRepo.sessions.get(sessionId) ?? null;
  },
  findMessagesBySessionId: async (sessionId: string) => {
    return chatRepo.messages.get(sessionId) ?? [];
  },
  insertChatMessage: async (
    sessionId: string,
    role: string,
    content: string,
    toolCalls?: unknown,
  ) => {
    const msg = {
      id: `msg-${Date.now()}`,
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
  },
  updateSessionScope: async () => {},
  deleteExpiredSessions: async () => {},
}));

mock.module("../repositories/document.js", () => ({
  findDocumentsByProjectId: async () => [],
  upsertDocument: async () => ({ conflict: false }),
}));

mock.module("../repositories/project.js", () => ({
  findMembership: async () => ({ role: "editor" }),
  findProjectsByUserId: async () => [],
  findProjectById: async () => null,
  countMembers: async () => 0,
  countDocuments: async () => 0,
  createProjectWithOwner: async () => ({}),
  updateProject: async () => ({}),
  deleteProject: async () => {},
}));

mock.module("../ws/broadcast.js", () => ({
  broadcastToChannel: () => {},
}));

let llmCallCount = 0;
let lastLlmMessages: any[] = [];

mock.module("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: (opts: any) => {
          llmCallCount++;
          lastLlmMessages = opts.messages;
          const handlers = new Map<string, Function>();
          const mockStream = {
            on: (event: string, handler: Function) => {
              handlers.set(event, handler);
              return mockStream;
            },
            finalMessage: async () => {
              const textHandler = handlers.get("text");
              if (textHandler) textHandler("Hello! ");
              if (textHandler) textHandler("How can I help?");
              return {
                content: [
                  { type: "text", text: "Hello! How can I help?" },
                ],
              };
            },
          };
          return mockStream;
        },
      };
    },
  };
});

import {
  startChatSession,
  resumeChatSession,
  sendChatMessage,
} from "../services/chat.js";

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
