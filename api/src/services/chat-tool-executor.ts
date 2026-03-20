import yaml from "js-yaml";
import { createHash } from "node:crypto";
import {
  findDocumentsByProjectId,
  upsertDocument,
} from "../repositories/document.js";
import {
  updateSessionScope,
  findToolCallByIdempotencyKey,
} from "../repositories/chat.js";
import { validateProject } from "./engine.js";
import { buildDocumentMap } from "./build.js";
import { broadcastToChannel } from "../ws/broadcast.js";
import type { ChatSessionScope } from "./chat-types.js";

export interface ToolExecutionContext {
  projectId: string;
  sessionId: string;
  scope: ChatSessionScope;
}

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<{ result: string; error?: boolean }> {
  switch (toolName) {
    case "edit_document":
      return executeEditDocument(toolInput, ctx);
    case "navigate_to_page":
      return executeNavigateToPage(toolInput, ctx);
    case "explain_schema":
      return executeExplainSchema(toolInput);
    case "list_pages":
      return executeListPages(ctx.projectId);
    case "list_components":
      return executeListComponents(ctx.projectId);
    case "list_templates":
      return executeListTemplates(ctx.projectId);
    default:
      return { result: `Unknown tool: ${toolName}`, error: true };
  }
}

async function executeEditDocument(
  input: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<{ result: string; error?: boolean; idempotencyKey?: string }> {
  const { documentType, documentId, content, idempotencyKey } = input as {
    documentType: string;
    documentId: string;
    content: string;
    idempotencyKey?: string;
  };

  // Idempotency check: skip if this key was already used in this session
  if (idempotencyKey) {
    const existing = await findToolCallByIdempotencyKey(
      ctx.sessionId,
      idempotencyKey,
    );
    if (existing) {
      return { result: existing.result };
    }
  }

  // Validate YAML parses
  try {
    yaml.load(content);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid YAML";
    return { result: `YAML parse error: ${msg}`, error: true };
  }

  // Load existing documents for validation and diff
  const rows = await findDocumentsByProjectId(ctx.projectId);
  const existingDoc = rows.find(
    (r) => r.documentType === documentType && r.documentId === documentId,
  );
  const oldContent = existingDoc?.content ?? null;
  const docMap = buildDocumentMap(rows);

  // Apply the new content to the document map for validation
  const parsed = yaml.load(content) as object;
  switch (documentType) {
    case "manifest":
      docMap.manifest = parsed;
      break;
    case "sitemap":
      docMap.sitemap = parsed;
      break;
    case "templates":
      docMap.templates = parsed;
      break;
    case "components":
      docMap.components = parsed;
      break;
    case "page":
      docMap.pages.set(documentId, parsed);
      break;
    case "dataset":
      docMap.datasets.set(documentId, parsed);
      break;
  }

  const validation = validateProject(docMap);
  if (!validation.ok) {
    const errors = validation.errors
      .map((e: { message: string }) => e.message)
      .join("; ");
    return {
      result: `Validation failed: ${errors}. Please fix the YAML and try again.`,
      error: true,
    };
  }

  // Save the document with conflict detection
  const contentHash = createHash("sha256").update(content).digest("hex");
  const expectedHash = existingDoc?.contentHash;
  const { conflict } = await upsertDocument(
    ctx.projectId,
    documentType,
    documentId,
    content,
    contentHash,
    expectedHash,
  );

  if (conflict) {
    return {
      result: "Conflict: the document was modified by another user. Please reload and try again.",
      error: true,
    };
  }

  // Broadcast the change via WebSocket (include old + new content for diff)
  broadcastToChannel(`project.${ctx.projectId}`, "document.updated", {
    documentType,
    documentId,
    contentHash,
    oldContent,
    newContent: content,
  });

  return {
    result: `Successfully updated ${documentType}:${documentId}. The document has been saved.`,
  };
}

async function executeNavigateToPage(
  input: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<{ result: string; error?: boolean }> {
  const { pageId } = input as { pageId: string };

  // Verify page exists
  const rows = await findDocumentsByProjectId(ctx.projectId);
  const pageExists = rows.some(
    (r) => r.documentType === "page" && r.documentId === pageId,
  );

  if (!pageExists) {
    return { result: `Page "${pageId}" not found in project.`, error: true };
  }

  const newScope: ChatSessionScope = { ...ctx.scope, activePage: pageId };
  await updateSessionScope(ctx.sessionId, newScope);

  broadcastToChannel(`chat.${ctx.sessionId}`, "chat.navigate", { pageId });

  return { result: `Navigated to page "${pageId}".` };
}

async function executeExplainSchema(
  input: Record<string, unknown>,
): Promise<{ result: string }> {
  const { topic } = input as { topic: string };
  return {
    result:
      `Schema explanation for "${topic}": The wireframe schema defines documents ` +
      `(pages, templates, components) as YAML files. Each page has a root node tree ` +
      `with layout (stack, row, grid), primitives (text, image, button), and ` +
      `styling properties. Templates define reusable page layouts with slots. ` +
      `Components are reusable node subtrees.`,
  };
}

async function executeListPages(
  projectId: string,
): Promise<{ result: string }> {
  const rows = await findDocumentsByProjectId(projectId);
  const pages = rows
    .filter((r) => r.documentType === "page")
    .map((r) => r.documentId);
  return {
    result:
      pages.length > 0
        ? `Pages in project: ${pages.join(", ")}`
        : "No pages found in project.",
  };
}

async function executeListComponents(
  projectId: string,
): Promise<{ result: string }> {
  const rows = await findDocumentsByProjectId(projectId);
  const compRow = rows.find((r) => r.documentType === "components");
  if (!compRow) return { result: "No components file found in project." };

  try {
    const parsed = yaml.load(compRow.content) as Record<string, unknown>;
    const names = Object.keys(parsed);
    return { result: `Components: ${names.join(", ")}` };
  } catch {
    return { result: "Components file exists but could not be parsed." };
  }
}

async function executeListTemplates(
  projectId: string,
): Promise<{ result: string }> {
  const rows = await findDocumentsByProjectId(projectId);
  const tplRow = rows.find((r) => r.documentType === "templates");
  if (!tplRow) return { result: "No templates file found in project." };

  try {
    const parsed = yaml.load(tplRow.content) as Record<string, unknown>;
    const names = Object.keys(parsed);
    return { result: `Templates: ${names.join(", ")}` };
  } catch {
    return { result: "Templates file exists but could not be parsed." };
  }
}
