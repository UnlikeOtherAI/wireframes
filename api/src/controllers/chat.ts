import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import {
  startChatSession,
  resumeChatSession,
  sendChatMessage,
} from "../services/chat.js";
import type { ChatSessionScope } from "../services/chat-types.js";

function requireUser(req: Request) {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

const VALID_WORKSPACE_MODES = new Set(["preview", "sitemap", "tree"]);
const VALID_RENDER_MODES = new Set(["line", "card"]);

function validateScope(raw: unknown): ChatSessionScope {
  if (!raw || typeof raw !== "object") {
    throw new ApiError(400, "Missing or invalid scope");
  }
  const scope = raw as Record<string, unknown>;
  const result: ChatSessionScope = {
    projectId: "",
  };

  if (typeof scope.activePage === "string") {
    result.activePage = scope.activePage;
  }
  if (typeof scope.selectedNode === "string") {
    result.selectedNode = scope.selectedNode;
  }
  if (
    typeof scope.workspaceMode === "string" &&
    VALID_WORKSPACE_MODES.has(scope.workspaceMode)
  ) {
    result.workspaceMode = scope.workspaceMode as ChatSessionScope["workspaceMode"];
  }
  if (typeof scope.device === "string") {
    result.device = scope.device;
  }
  if (
    typeof scope.renderMode === "string" &&
    VALID_RENDER_MODES.has(scope.renderMode)
  ) {
    result.renderMode = scope.renderMode as ChatSessionScope["renderMode"];
  }

  return result;
}

export async function createChatSessionController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);

  let body: { scope?: unknown };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  const scope = validateScope(body.scope);
  const result = await startChatSession(user.userId, projectId, scope);
  return Response.json(result, { status: 201 });
}

export async function getChatSessionController(
  req: Request,
  projectId: string,
  sessionId: string,
): Promise<Response> {
  const user = requireUser(req);
  const result = await resumeChatSession(user.userId, projectId, sessionId);
  return Response.json(result);
}

export async function sendChatMessageController(
  req: Request,
  projectId: string,
  sessionId: string,
): Promise<Response> {
  const user = requireUser(req);

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
    throw new ApiError(400, "Missing or empty message content");
  }

  const result = await sendChatMessage(
    user.userId,
    projectId,
    sessionId,
    body.content.trim(),
  );
  return Response.json(result);
}
