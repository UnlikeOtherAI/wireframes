export interface ChatSessionScope {
  projectId: string;
  activePage?: string;
  selectedNode?: string;
  workspaceMode?: "preview" | "sitemap" | "tree";
  device?: string;
  renderMode?: "line" | "card";
}

export interface ChatMessageRow {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: unknown;
  createdAt: Date;
}

export interface ChatSessionRow {
  id: string;
  projectId: string;
  userId: string;
  scope: ChatSessionScope;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ChatToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  idempotencyKey?: string;
}
