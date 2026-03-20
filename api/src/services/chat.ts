import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "../middleware/error-handler.js";
import { requireProjectAccess } from "./project.js";
import {
  createChatSession,
  findChatSession,
  findMessagesBySessionId,
  insertChatMessage,
  updateSessionScope,
  deleteExpiredSessions,
} from "../repositories/chat.js";
import { findDocumentsByProjectId } from "../repositories/document.js";
import { broadcastToChannel } from "../ws/broadcast.js";
import { chatTools } from "./chat-tools.js";
import { executeToolCall } from "./chat-tool-executor.js";
import type { ChatSessionScope, ChatToolCall } from "./chat-types.js";

const MAX_HISTORY_MESSAGES = 20;

// Rate limiting: 1 concurrent LLM call per session
const activeCalls = new Set<string>();

function getClient(): Anthropic {
  return new Anthropic();
}

function buildSystemPrompt(
  scope: ChatSessionScope,
  projectContext: string,
): string {
  return [
    "You are a wireframe design assistant. You help users create and edit wireframe prototypes defined in YAML.",
    "The wireframe schema uses documents: pages (UI layouts), templates (reusable page structures with slots), and components (reusable node subtrees).",
    "Nodes have types like: stack, row, grid, text, image, button, input, select, checkbox, link, divider, icon, card, list, table, form, nav, header, footer, sidebar, modal, tabs, accordion.",
    "Layout properties: direction, gap, padding, alignment. Style properties: background, border, borderRadius, shadow, opacity.",
    "When editing documents, always provide complete valid YAML content.",
    "",
    `Current scope:`,
    `- Project: ${scope.projectId}`,
    scope.activePage ? `- Active page: ${scope.activePage}` : "- No active page",
    scope.selectedNode ? `- Selected node: ${scope.selectedNode}` : "",
    scope.workspaceMode ? `- Mode: ${scope.workspaceMode}` : "",
    scope.device ? `- Device: ${scope.device}` : "",
    scope.renderMode ? `- Render mode: ${scope.renderMode}` : "",
    "",
    "Project structure:",
    projectContext,
  ]
    .filter(Boolean)
    .join("\n");
}

async function loadProjectContext(
  projectId: string,
  scope: ChatSessionScope,
): Promise<{ systemContext: string; activePageContent: string | null }> {
  const rows = await findDocumentsByProjectId(projectId);

  const pages = rows.filter((r) => r.documentType === "page");
  const templates = rows.find((r) => r.documentType === "templates");
  const components = rows.find((r) => r.documentType === "components");

  const lines: string[] = [];
  lines.push(`${pages.length} page(s): ${pages.map((p) => p.documentId).join(", ") || "none"}`);
  if (templates) lines.push("Templates file present");
  if (components) lines.push("Components file present");

  let activePageContent: string | null = null;
  if (scope.activePage) {
    const page = pages.find((p) => p.documentId === scope.activePage);
    if (page) {
      activePageContent = page.content;
    }
  }

  return { systemContext: lines.join("\n"), activePageContent };
}

function trimHistory(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  return trimmed.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function startChatSession(
  userId: string,
  projectId: string,
  scope: ChatSessionScope,
) {
  await requireProjectAccess(userId, projectId);

  // Clean up expired sessions on access
  deleteExpiredSessions().catch(() => {});

  const session = await createChatSession(projectId, userId, {
    ...scope,
    projectId,
  });

  return { sessionId: session.id, messages: [] };
}

export async function resumeChatSession(
  userId: string,
  projectId: string,
  sessionId: string,
) {
  await requireProjectAccess(userId, projectId);

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
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      createdAt: m.createdAt,
    })),
  };
}

export async function sendChatMessage(
  userId: string,
  projectId: string,
  sessionId: string,
  content: string,
) {
  await requireProjectAccess(userId, projectId);

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

  // Rate limit: 1 concurrent LLM call per session
  if (activeCalls.has(sessionId)) {
    throw new ApiError(429, "A message is already being processed for this session");
  }

  activeCalls.add(sessionId);
  try {
    const userMessage = await insertChatMessage(sessionId, "user", content);

    const history = await findMessagesBySessionId(sessionId);
    const { systemContext, activePageContent } = await loadProjectContext(
      projectId,
      session.scope as ChatSessionScope,
    );

    const systemPrompt = buildSystemPrompt(
      session.scope as ChatSessionScope,
      systemContext,
    );

    const llmMessages = trimHistory(
      history.map((m) => ({ role: m.role, content: m.content })),
    );

    // Add active page content as context if available
    if (activePageContent) {
      const contextMsg = `[Current page YAML]\n\`\`\`yaml\n${activePageContent}\n\`\`\``;
      if (llmMessages.length > 0 && llmMessages[llmMessages.length - 1].role === "user") {
        llmMessages[llmMessages.length - 1].content += "\n\n" + contextMsg;
      }
    }

    let assistantResponse: LlmResponse;
    try {
      assistantResponse = await callLlmWithStreaming(
        systemPrompt,
        llmMessages,
        sessionId,
        { projectId, sessionId, scope: session.scope as ChatSessionScope },
      );
    } catch (err) {
      const channel = `chat.${sessionId}`;
      const msg = err instanceof Error ? err.message : "LLM request failed";
      broadcastToChannel(channel, "chat.stream.error", { error: msg });
      throw new ApiError(502, "LLM request failed");
    }

    const assistantMessage = await insertChatMessage(
      sessionId,
      "assistant",
      assistantResponse.content,
      assistantResponse.toolCalls.length > 0 ? assistantResponse.toolCalls : null,
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

interface LlmResponse {
  content: string;
  toolCalls: ChatToolCall[];
}

type AnthropicMessage = Anthropic.MessageParam;

const MAX_TOOL_ROUNDS = 3;

async function callLlmWithStreaming(
  systemPrompt: string,
  messages: AnthropicMessage[],
  sessionId: string,
  ctx: { projectId: string; sessionId: string; scope: ChatSessionScope },
): Promise<LlmResponse> {
  const client = getClient();
  const channel = `chat.${sessionId}`;
  const allToolCalls: ChatToolCall[] = [];
  let currentMessages = [...messages];
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: chatTools,
      messages: currentMessages,
    });

    let roundText = "";
    stream.on("text", (text) => {
      roundText += text;
      broadcastToChannel(channel, "chat.stream.token", { token: text });
    });

    const response = await stream.finalMessage();

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    finalText = textBlocks.map((b) => b.text).join("") || roundText;

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      break;
    }

    // Execute tool calls and collect results
    const toolResultContent: Anthropic.ToolResultBlockParam[] = [];
    let hasError = false;

    for (const toolUse of toolUseBlocks) {
      const executionResult = await executeToolCall(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        ctx,
      );

      allToolCalls.push({
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
        result: executionResult.result,
      });

      toolResultContent.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: executionResult.result,
      });

      if (executionResult.error) hasError = true;
    }

    // Send tool results back to Claude for a follow-up turn
    currentMessages = [
      ...currentMessages,
      { role: "assistant" as const, content: response.content },
      { role: "user" as const, content: toolResultContent },
    ];

    // If there was a validation error and this is the first retry, let LLM self-correct
    // Otherwise if no error, still send results back for the LLM to produce a text summary
    if (hasError && round >= 1) {
      break;
    }
  }

  broadcastToChannel(channel, "chat.stream.done", {
    content: finalText,
    toolCalls: allToolCalls,
  });

  return { content: finalText, toolCalls: allToolCalls };
}
