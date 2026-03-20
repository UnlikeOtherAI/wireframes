import { describe, test, expect, mock, beforeEach, beforeAll } from "bun:test";

let serviceState = {
  sessionResult: null as any,
  resumeResult: null as any,
  sendResult: null as any,
  startCalled: false,
  resumeCalled: false,
  sendCalled: false,
  lastStartArgs: null as any,
  lastSendArgs: null as any,
};

function resetService() {
  serviceState = {
    sessionResult: null,
    resumeResult: null,
    sendResult: null,
    startCalled: false,
    resumeCalled: false,
    sendCalled: false,
    lastStartArgs: null,
    lastSendArgs: null,
  };
}

mock.module("../services/chat.js", () => ({
  startChatSession: async (userId: string, projectId: string, scope: any) => {
    serviceState.startCalled = true;
    serviceState.lastStartArgs = { userId, projectId, scope };
    return serviceState.sessionResult;
  },
  resumeChatSession: async (
    userId: string,
    projectId: string,
    sessionId: string,
  ) => {
    serviceState.resumeCalled = true;
    return serviceState.resumeResult;
  },
  sendChatMessage: async (
    userId: string,
    projectId: string,
    sessionId: string,
    content: string,
  ) => {
    serviceState.sendCalled = true;
    serviceState.lastSendArgs = { userId, projectId, sessionId, content };
    return serviceState.sendResult;
  },
}));

import {
  createChatSessionController,
  getChatSessionController,
  sendChatMessageController,
} from "../controllers/chat.js";
import { errorHandler } from "../middleware/error-handler.js";
import { auth } from "../middleware/auth.js";
import { signJwt } from "../services/jwt.js";

let testJwt: string;
let createHandler: (req: Request) => Promise<Response>;
let getHandler: (req: Request) => Promise<Response>;
let sendHandler: (req: Request) => Promise<Response>;

beforeAll(() => {
  testJwt = signJwt(
    { userId: "user-1", email: "test@example.com" },
    "test-secret",
  );

  createHandler = errorHandler(
    auth((r) => createChatSessionController(r, "project-1")),
  );
  getHandler = errorHandler(
    auth((r) => getChatSessionController(r, "project-1", "session-1")),
  );
  sendHandler = errorHandler(
    auth((r) => sendChatMessageController(r, "project-1", "session-1")),
  );
});

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

describe("createChatSessionController", () => {
  beforeEach(resetService);

  test("creates session and returns 201", async () => {
    serviceState.sessionResult = { sessionId: "s1", messages: [] };

    const res = await createHandler(
      makeRequest("/projects/project-1/chat/sessions", "POST", {
        scope: { activePage: "home" },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionId).toBe("s1");
    expect(body.messages).toEqual([]);
    expect(serviceState.startCalled).toBe(true);
    expect(serviceState.lastStartArgs.scope.activePage).toBe("home");
  });

  test("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/projects/p1/chat/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${testJwt}` },
      body: "not json",
    });
    const res = await createHandler(req);
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing scope", async () => {
    serviceState.sessionResult = { sessionId: "s1", messages: [] };

    const res = await createHandler(
      makeRequest("/projects/project-1/chat/sessions", "POST", {}),
    );
    expect(res.status).toBe(400);
  });

  test("returns 401 without auth", async () => {
    const res = await createHandler(
      makeRequest(
        "/projects/project-1/chat/sessions",
        "POST",
        { scope: {} },
        false,
      ),
    );
    expect(res.status).toBe(401);
  });

  test("validates scope fields correctly", async () => {
    serviceState.sessionResult = { sessionId: "s1", messages: [] };

    const res = await createHandler(
      makeRequest("/projects/project-1/chat/sessions", "POST", {
        scope: {
          activePage: "home",
          workspaceMode: "preview",
          renderMode: "card",
          device: "mobile",
          selectedNode: "wf://page/node",
          invalidField: "ignored",
        },
      }),
    );
    expect(res.status).toBe(201);
    const args = serviceState.lastStartArgs.scope;
    expect(args.activePage).toBe("home");
    expect(args.workspaceMode).toBe("preview");
    expect(args.renderMode).toBe("card");
    expect(args.device).toBe("mobile");
    expect(args.selectedNode).toBe("wf://page/node");
  });

  test("ignores invalid workspaceMode values", async () => {
    serviceState.sessionResult = { sessionId: "s1", messages: [] };

    const res = await createHandler(
      makeRequest("/projects/project-1/chat/sessions", "POST", {
        scope: { workspaceMode: "invalid" },
      }),
    );
    expect(res.status).toBe(201);
    expect(serviceState.lastStartArgs.scope.workspaceMode).toBeUndefined();
  });
});

describe("getChatSessionController", () => {
  beforeEach(resetService);

  test("returns session with messages", async () => {
    serviceState.resumeResult = {
      sessionId: "session-1",
      messages: [
        { id: "m1", role: "user", content: "hello", createdAt: new Date() },
      ],
    };

    const res = await getHandler(
      makeRequest("/projects/project-1/chat/sessions/session-1", "GET"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe("session-1");
    expect(body.messages).toHaveLength(1);
  });

  test("returns 401 without auth", async () => {
    const res = await getHandler(
      makeRequest(
        "/projects/project-1/chat/sessions/session-1",
        "GET",
        undefined,
        false,
      ),
    );
    expect(res.status).toBe(401);
  });
});

describe("sendChatMessageController", () => {
  beforeEach(resetService);

  test("sends message and returns result", async () => {
    serviceState.sendResult = {
      userMessage: { id: "m1", role: "user", content: "hi" },
      assistantMessage: { id: "m2", role: "assistant", content: "hello" },
    };

    const res = await sendHandler(
      makeRequest(
        "/projects/project-1/chat/sessions/session-1/messages",
        "POST",
        { content: "hi" },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userMessage.content).toBe("hi");
    expect(body.assistantMessage.content).toBe("hello");
    expect(serviceState.lastSendArgs.content).toBe("hi");
  });

  test("returns 400 for missing content", async () => {
    const res = await sendHandler(
      makeRequest(
        "/projects/project-1/chat/sessions/session-1/messages",
        "POST",
        {},
      ),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for empty content", async () => {
    const res = await sendHandler(
      makeRequest(
        "/projects/project-1/chat/sessions/session-1/messages",
        "POST",
        { content: "   " },
      ),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON", async () => {
    const req = new Request(
      "http://localhost/projects/p1/chat/sessions/s1/messages",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${testJwt}` },
        body: "not json",
      },
    );
    const res = await sendHandler(req);
    expect(res.status).toBe(400);
  });

  test("returns 401 without auth", async () => {
    const res = await sendHandler(
      makeRequest(
        "/projects/project-1/chat/sessions/session-1/messages",
        "POST",
        { content: "hi" },
        false,
      ),
    );
    expect(res.status).toBe(401);
  });
});
