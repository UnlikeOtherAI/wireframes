import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createChatSession,
  resumeChatSession,
  sendChatMessage,
  type ChatMessage,
  type ChatSessionScope,
} from '../../api/chat'
import { buildProject } from '../../api/build'
import { useAuthStore } from '../../stores/authStore'
import { diffLines, type DiffLine } from './diff'

interface PendingChange {
  documentType: string
  documentId: string
  oldContent: string
  newContent: string
  lines: DiffLine[]
}

interface UseChatSessionOptions {
  projectId: string
  scope: ChatSessionScope
  isOpen: boolean
  onApplyDocument: (documentType: string, documentId: string, content: string) => Promise<void>
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
type LocalMessage = ChatMessage & { localStatus?: 'streaming' | 'error' }

const sessionKey = (projectId: string) => `wf_chat_session:${projectId}`

function getWsUrl(token: string | null): string {
  const base = import.meta.env.VITE_API_URL ?? window.location.origin
  const url = new URL(base, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws'
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export function useChatSession({
  projectId,
  scope,
  isOpen,
  onApplyDocument,
}: UseChatSessionOptions) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [isSending, setIsSending] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const loadedRef = useRef(false)
  const streamingMessageRef = useRef<string | null>(null)

  const token = useAuthStore((state) => state.token)

  const subscribe = useCallback(() => {
    const ws = wsRef.current
    const sessionId = sessionIdRef.current
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      ws.send(JSON.stringify({ type: 'subscribe', channel: `chat.${sessionId}` }))
    }
  }, [])

  const closeSocket = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current)
    reconnectRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    setConnectionStatus('disconnected')
  }, [])

  const connectSocket = useCallback(() => {
    if (!isOpen || wsRef.current) return

    setConnectionStatus(loadedRef.current ? 'reconnecting' : 'connecting')
    const ws = new WebSocket(getWsUrl(token))
    wsRef.current = ws

    ws.addEventListener('open', () => {
      reconnectAttemptRef.current = 0
      setConnectionStatus('connected')
      subscribe()
    })

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(String(event.data)) as {
        type: string
        payload?: Record<string, unknown>
      }

      if (data.type === 'chat.stream.token') {
        const targetId = streamingMessageRef.current
        const tokenPart = typeof data.payload?.token === 'string' ? data.payload.token : ''
        if (!targetId || !tokenPart) return
        setMessages((prev) => prev.map((message) => (
          message.id === targetId
            ? { ...message, content: `${message.content}${tokenPart}`, localStatus: 'streaming' }
            : message
        )))
        return
      }

      if (data.type === 'chat.stream.done') {
        const targetId = streamingMessageRef.current
        const content = typeof data.payload?.content === 'string' ? data.payload.content : ''
        if (!targetId) return
        setMessages((prev) => prev.map((message) => (
          message.id === targetId
            ? { ...message, content: content || message.content, localStatus: undefined }
            : message
        )))
        streamingMessageRef.current = null
        return
      }

      if (data.type === 'chat.stream.error') {
        const targetId = streamingMessageRef.current
        if (!targetId) return
        setMessages((prev) => prev.map((message) => (
          message.id === targetId
            ? { ...message, localStatus: 'error' }
            : message
        )))
        setError(typeof data.payload?.error === 'string' ? data.payload.error : null)
        streamingMessageRef.current = null
        return
      }

      if (data.type === 'document.pending') {
        const documentType = typeof data.payload?.documentType === 'string' ? data.payload.documentType : ''
        const documentId = typeof data.payload?.documentId === 'string' ? data.payload.documentId : ''
        const oldContent = typeof data.payload?.oldContent === 'string' ? data.payload.oldContent : ''
        const newContent = typeof data.payload?.newContent === 'string' ? data.payload.newContent : ''
        if (!documentType || !documentId) return
        setPendingChange({
          documentType,
          documentId,
          oldContent,
          newContent,
          lines: diffLines(oldContent, newContent),
        })
      }
    })

    ws.addEventListener('close', () => {
      wsRef.current = null
      if (!isOpen) {
        setConnectionStatus('disconnected')
        return
      }
      const delay = Math.min(1000 * (2 ** reconnectAttemptRef.current), 5000)
      reconnectAttemptRef.current += 1
      setConnectionStatus('reconnecting')
      reconnectRef.current = setTimeout(connectSocket, delay)
    })
  }, [isOpen, subscribe, token])

  const loadSession = useCallback(async () => {
    if (!isOpen || loadedRef.current) return

    const storedSessionId = sessionStorage.getItem(sessionKey(projectId))
    if (!storedSessionId) {
      loadedRef.current = true
      return
    }

    const session = await resumeChatSession(projectId, storedSessionId)
    sessionIdRef.current = session.sessionId
    sessionStorage.setItem(sessionKey(projectId), session.sessionId)
    setMessages(session.messages)
    loadedRef.current = true
    subscribe()
  }, [isOpen, projectId, subscribe])

  useEffect(() => {
    setMessages([])
    setInput('')
    setPendingChange(null)
    setError(null)
    loadedRef.current = false
    sessionIdRef.current = null
    streamingMessageRef.current = null
    closeSocket()
  }, [projectId, closeSocket])

  useEffect(() => {
    if (!isOpen) {
      closeSocket()
      return
    }
    connectSocket()
    loadSession().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t('chat.errors.session'))
    })
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [closeSocket, connectSocket, isOpen, loadSession, t])

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current
    const session = await createChatSession(projectId, scope)
    sessionIdRef.current = session.sessionId
    sessionStorage.setItem(sessionKey(projectId), session.sessionId)
    subscribe()
    return session.sessionId
  }, [projectId, scope, subscribe])

  const sendUserMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    setError(null)
    setIsSending(true)
    const localUserId = `local-user-${crypto.randomUUID()}`
    const localAssistantId = `local-assistant-${crypto.randomUUID()}`
    streamingMessageRef.current = localAssistantId
    setMessages((prev) => [
      ...prev,
      { id: localUserId, role: 'user', content: trimmed },
      { id: localAssistantId, role: 'assistant', content: '', localStatus: 'streaming' },
    ])

    try {
      const sessionId = await ensureSession()
      const response = await sendChatMessage(projectId, sessionId, trimmed, scope)
      setMessages((prev) => prev.map((message) => {
        if (message.id === localUserId) return response.userMessage
        if (message.id === localAssistantId && !message.content) {
          return { ...response.assistantMessage, localStatus: undefined }
        }
        return message
      }))
    } catch (err) {
      setMessages((prev) => prev.map((message) => (
        message.id === localAssistantId
          ? { ...message, localStatus: 'error' }
          : message
      )))
      setError(err instanceof Error ? err.message : t('chat.errors.message'))
      streamingMessageRef.current = null
    } finally {
      setIsSending(false)
    }
  }, [ensureSession, projectId, scope, t])

  const submit = useCallback(async () => {
    const content = input
    setInput('')
    await sendUserMessage(content)
  }, [input, sendUserMessage])

  const rejectChange = useCallback(async () => {
    if (!pendingChange) return
    setPendingChange(null)
    await sendUserMessage(
      `Please discard the proposed edit for ${pendingChange.documentType}:${pendingChange.documentId} and try a different approach.`,
    )
  }, [pendingChange, sendUserMessage])

  const applyChange = useCallback(async () => {
    if (!pendingChange) return
    setIsApplying(true)
    setError(null)
    try {
      await onApplyDocument(
        pendingChange.documentType,
        pendingChange.documentId,
        pendingChange.newContent,
      )
      setPendingChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.errors.apply'))
    } finally {
      setIsApplying(false)
    }
  }, [onApplyDocument, pendingChange, t])

  const startNewConversation = useCallback(() => {
    sessionStorage.removeItem(sessionKey(projectId))
    sessionIdRef.current = null
    streamingMessageRef.current = null
    setMessages([])
    setPendingChange(null)
    setError(null)
    closeSocket()
    if (isOpen) connectSocket()
  }, [closeSocket, connectSocket, isOpen, projectId])

  const triggerBuildPreview = useCallback(async () => {
    await buildProject(projectId)
  }, [projectId])

  return {
    messages,
    input,
    setInput,
    isSending,
    pendingChange,
    connectionStatus,
    error,
    isApplying,
    submit,
    sendUserMessage,
    rejectChange,
    applyChange,
    startNewConversation,
    triggerBuildPreview,
    pendingDocumentLabel: useMemo(() => (
      pendingChange ? `${pendingChange.documentType}:${pendingChange.documentId}` : ''
    ), [pendingChange]),
  }
}
