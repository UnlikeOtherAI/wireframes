import { apiFetch } from './client'

export interface ChatSessionScope {
  projectId: string
  activePage?: string
  selectedNode?: string
  workspaceMode?: 'preview' | 'sitemap' | 'tree'
  device?: string
  renderMode?: 'line' | 'card'
}

export interface ChatToolCall {
  name: string
  input: Record<string, unknown>
  result?: unknown
  idempotencyKey?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ChatToolCall[] | null
  createdAt?: string
}

export interface ChatSessionResponse {
  sessionId: string
  messages: ChatMessage[]
}

export interface SendChatMessageResponse {
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}

export function createChatSession(
  projectId: string,
  scope: ChatSessionScope,
): Promise<ChatSessionResponse> {
  return apiFetch<ChatSessionResponse>(
    `/projects/${encodeURIComponent(projectId)}/chat/sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ scope }),
    },
  )
}

export function resumeChatSession(
  projectId: string,
  sessionId: string,
): Promise<ChatSessionResponse> {
  return apiFetch<ChatSessionResponse>(
    `/projects/${encodeURIComponent(projectId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
  )
}

export function sendChatMessage(
  projectId: string,
  sessionId: string,
  content: string,
  scope: ChatSessionScope,
): Promise<SendChatMessageResponse> {
  return apiFetch<SendChatMessageResponse>(
    `/projects/${encodeURIComponent(projectId)}/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, scope }),
    },
  )
}
