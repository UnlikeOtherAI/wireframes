import { describe, test, expect } from "bun:test";
import { chatTools } from "../services/chat-tools.js";

describe("chatTools", () => {
  test("defines all required tools", () => {
    const names = chatTools.map((t) => t.name);
    expect(names).toContain("edit_document");
    expect(names).toContain("navigate_to_page");
    expect(names).toContain("explain_schema");
    expect(names).toContain("list_pages");
    expect(names).toContain("list_components");
    expect(names).toContain("list_templates");
  });

  test("each tool has name, description, and input_schema", () => {
    for (const tool of chatTools) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
    }
  });

  test("edit_document requires documentType, documentId, content", () => {
    const tool = chatTools.find((t) => t.name === "edit_document")!;
    const schema = tool.input_schema as any;
    expect(schema.required).toContain("documentType");
    expect(schema.required).toContain("documentId");
    expect(schema.required).toContain("content");
  });

  test("navigate_to_page requires pageId", () => {
    const tool = chatTools.find((t) => t.name === "navigate_to_page")!;
    const schema = tool.input_schema as any;
    expect(schema.required).toContain("pageId");
  });

  test("edit_document documentType has valid enum", () => {
    const tool = chatTools.find((t) => t.name === "edit_document")!;
    const schema = tool.input_schema as any;
    const docType = schema.properties.documentType;
    expect(docType.enum).toContain("page");
    expect(docType.enum).toContain("templates");
    expect(docType.enum).toContain("components");
  });
});
