import {
  createChatSessionController,
  getChatSessionController,
  sendChatMessageController,
} from "../controllers/chat.js";

const SESSIONS_PATTERN =
  /^\/projects\/([0-9a-f-]{36})\/chat\/sessions$/;
const SESSION_PATTERN =
  /^\/projects\/([0-9a-f-]{36})\/chat\/sessions\/([0-9a-f-]{36})$/;
const MESSAGES_PATTERN =
  /^\/projects\/([0-9a-f-]{36})\/chat\/sessions\/([0-9a-f-]{36})\/messages$/;

export function handleChatRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);

  const sessionsMatch = SESSIONS_PATTERN.exec(url.pathname);
  if (sessionsMatch) {
    const projectId = sessionsMatch[1];
    if (req.method === "POST")
      return createChatSessionController(req, projectId);
    return null;
  }

  const messagesMatch = MESSAGES_PATTERN.exec(url.pathname);
  if (messagesMatch) {
    const projectId = messagesMatch[1];
    const sessionId = messagesMatch[2];
    if (req.method === "POST")
      return sendChatMessageController(req, projectId, sessionId);
    return null;
  }

  const sessionMatch = SESSION_PATTERN.exec(url.pathname);
  if (sessionMatch) {
    const projectId = sessionMatch[1];
    const sessionId = sessionMatch[2];
    if (req.method === "GET")
      return getChatSessionController(req, projectId, sessionId);
    return null;
  }

  return null;
}
