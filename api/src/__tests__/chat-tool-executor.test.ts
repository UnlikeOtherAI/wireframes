import { describe, test, expect, mock, beforeEach } from "bun:test";

let documentRows: any[] = [];
let upsertCalled = false;
let lastUpsertArgs: any = null;

mock.module("../repositories/document.js", () => ({
  findDocumentsByProjectId: async () => documentRows,
  upsertDocument: async (
    projectId: string,
    documentType: string,
    documentId: string,
    content: string,
    contentHash: string,
    expectedHash?: string,
  ) => {
    upsertCalled = true;
    lastUpsertArgs = {
      projectId,
      documentType,
      documentId,
      content,
      contentHash,
      expectedHash,
    };
    if (expectedHash && expectedHash !== "current-hash") {
      return { conflict: true };
    }
    return { conflict: false };
  },
}));

mock.module("../repositories/chat.js", () => ({
  updateSessionScope: async () => {},
  findToolCallByIdempotencyKey: async () => null,
}));

mock.module("../services/engine.js", () => ({
  validateProject: () => ({ ok: true, errors: [], warnings: [] }),
  buildProject: () => ({ ok: true, html: "" }),
}));

mock.module("../ws/broadcast.js", () => ({
  broadcastToChannel: () => {},
}));

import { executeToolCall } from "../services/chat-tool-executor.js";
import type { ToolExecutionContext } from "../services/chat-tool-executor.js";

const ctx: ToolExecutionContext = {
  projectId: "project-1",
  sessionId: "session-1",
  scope: { projectId: "project-1", activePage: "home" },
};

describe("executeToolCall", () => {
  beforeEach(() => {
    documentRows = [];
    upsertCalled = false;
    lastUpsertArgs = null;
  });

  test("returns error for unknown tool", async () => {
    const result = await executeToolCall("unknown_tool", {}, ctx);
    expect(result.error).toBe(true);
    expect(result.result).toContain("Unknown tool");
  });

  test("explain_schema returns explanation", async () => {
    const result = await executeToolCall(
      "explain_schema",
      { topic: "nodes" },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Schema explanation");
  });

  test("list_pages returns page list", async () => {
    documentRows = [
      { documentType: "page", documentId: "home", content: "", contentHash: "" },
      { documentType: "page", documentId: "about", content: "", contentHash: "" },
    ];

    const result = await executeToolCall("list_pages", {}, ctx);
    expect(result.result).toContain("home");
    expect(result.result).toContain("about");
  });

  test("list_pages returns message when no pages", async () => {
    const result = await executeToolCall("list_pages", {}, ctx);
    expect(result.result).toContain("No pages found");
  });

  test("edit_document returns YAML error for invalid YAML", async () => {
    const result = await executeToolCall(
      "edit_document",
      { documentType: "page", documentId: "home", content: "{{invalid" },
      ctx,
    );
    expect(result.error).toBe(true);
    expect(result.result).toContain("YAML parse error");
  });

  test("edit_document saves valid YAML via repository", async () => {
    documentRows = [
      {
        documentType: "page",
        documentId: "home",
        content: "title: Home",
        contentHash: "current-hash",
      },
    ];

    const result = await executeToolCall(
      "edit_document",
      { documentType: "page", documentId: "home", content: "title: Updated Home" },
      ctx,
    );

    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Successfully updated");
    expect(upsertCalled).toBe(true);
    expect(lastUpsertArgs.projectId).toBe("project-1");
    expect(lastUpsertArgs.documentType).toBe("page");
    expect(lastUpsertArgs.documentId).toBe("home");
    expect(lastUpsertArgs.expectedHash).toBe("current-hash");
  });

  test("edit_document returns conflict error when hash mismatch", async () => {
    documentRows = [
      {
        documentType: "page",
        documentId: "home",
        content: "title: Home",
        contentHash: "stale-hash",
      },
    ];

    const result = await executeToolCall(
      "edit_document",
      { documentType: "page", documentId: "home", content: "title: Updated" },
      ctx,
    );

    expect(result.error).toBe(true);
    expect(result.result).toContain("Conflict");
  });

  test("navigate_to_page returns error for non-existent page", async () => {
    const result = await executeToolCall(
      "navigate_to_page",
      { pageId: "nonexistent" },
      ctx,
    );
    expect(result.error).toBe(true);
    expect(result.result).toContain("not found");
  });

  test("navigate_to_page succeeds for existing page", async () => {
    documentRows = [
      { documentType: "page", documentId: "about", content: "", contentHash: "" },
    ];

    const result = await executeToolCall(
      "navigate_to_page",
      { pageId: "about" },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Navigated to page");
  });
});
