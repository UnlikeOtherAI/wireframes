import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";

export const chatTools: Tool[] = [
  {
    name: "edit_document",
    description:
      "Replace the entire YAML content of a document (page, template, or component). " +
      "Provide the full new YAML content. The server will validate and save it.",
    input_schema: {
      type: "object" as const,
      properties: {
        documentType: {
          type: "string",
          enum: ["page", "templates", "components", "manifest", "sitemap"],
          description: "The type of document to edit",
        },
        documentId: {
          type: "string",
          description:
            "The document identifier (e.g. page slug for pages, 'templates' for the templates file)",
        },
        content: {
          type: "string",
          description: "The complete new YAML content for the document",
        },
      },
      required: ["documentType", "documentId", "content"],
    },
  },
  {
    name: "navigate_to_page",
    description: "Change the active page in the user's workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "string",
          description: "The page ID to navigate to",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "explain_schema",
    description:
      "Answer questions about the wireframe schema, node types, " +
      "layout properties, or how to structure YAML files.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "The schema topic to explain",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "list_pages",
    description: "List all pages in the current project.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_components",
    description: "List all components defined in the project.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_templates",
    description: "List all templates defined in the project.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];
