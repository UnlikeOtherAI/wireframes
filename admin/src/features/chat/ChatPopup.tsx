import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatSessionScope } from '../../api/chat'
import { ActionButtons } from './ActionButtons'
import { DiffPreview } from './DiffPreview'
import { MarkdownMessage } from './MarkdownMessage'
import { useChatSession } from './useChatSession'

interface ChatPopupProps {
  projectId: string
  scope: ChatSessionScope
  onApplyDocument: (documentType: string, documentId: string, content: string) => Promise<void>
}

export function ChatPopup({ projectId, scope, onApplyDocument }: ChatPopupProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    input,
    setInput,
    isSending,
    pendingChange,
    connectionStatus,
    error,
    isApplying,
    submit,
    rejectChange,
    applyChange,
    startNewConversation,
    triggerBuildPreview,
    pendingDocumentLabel,
  } = useChatSession({ projectId, scope, isOpen, onApplyDocument })

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  useEffect(() => {
    const node = messagesEndRef.current
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, pendingChange])

  const statusLabel = useMemo(() => t(`chat.status.${connectionStatus}`), [connectionStatus, t])

  return (
    <>
      <button
        type="button"
        aria-label={t('chat.open')}
        onClick={() => setIsOpen((prev) => !prev)}
        style={floatingButtonStyle}
      >
        {t('chat.button')}
      </button>

      {isOpen && (
        <section
          aria-label={t('chat.panel')}
          data-testid="chat-popup"
          style={panelStyle}
        >
          <header style={headerStyle}>
            <div>
              <div style={{ fontWeight: 600 }}>{t('chat.title')}</div>
              <div data-testid="chat-connection-status" style={{ fontSize: '12px', color: '#666' }}>
                {statusLabel}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={startNewConversation}>
                {t('chat.newConversation')}
              </button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label={t('chat.close')}>
                {t('chat.close')}
              </button>
            </div>
          </header>

          <div style={bodyStyle}>
            <div style={threadStyle}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  data-testid={`chat-message-${message.role}`}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'stretch',
                    maxWidth: message.role === 'user' ? '80%' : '100%',
                    background: message.role === 'user' ? '#e3f2fd' : '#f7f7f7',
                    borderRadius: '10px',
                    padding: '10px 12px',
                  }}
                >
                  {message.role === 'assistant'
                    ? <MarkdownMessage content={message.content || t('chat.streamingPlaceholder')} />
                    : <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{message.content}</div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {pendingChange && (
              <DiffPreview
                documentLabel={pendingDocumentLabel}
                lines={pendingChange.lines}
                onApply={applyChange}
                onReject={rejectChange}
                busy={isApplying}
              />
            )}

            {error && (
              <div role="alert" style={{ color: '#b3261e', fontSize: '12px' }}>
                {error}
              </div>
            )}

            <ActionButtons
              activePage={scope.activePage}
              selectedNode={scope.selectedNode}
              onPromptSelect={setInput}
              onBuildPreview={triggerBuildPreview}
              disabled={isSending}
            />

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <textarea
                aria-label={t('chat.input')}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                style={{
                  flex: 1,
                  resize: 'vertical',
                  minHeight: '88px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                }}
              />
              <button type="submit" disabled={isSending || !input.trim()} style={{ minWidth: '72px' }}>
                {isSending ? t('chat.sending') : t('chat.send')}
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  )
}

const floatingButtonStyle: CSSProperties = {
  position: 'fixed',
  right: '24px',
  bottom: '24px',
  minWidth: '56px',
  minHeight: '56px',
  borderRadius: '999px',
  border: 'none',
  background: '#17324d',
  color: '#fff',
  padding: '0 18px',
  cursor: 'pointer',
  boxShadow: '0 10px 30px rgba(23, 50, 77, 0.25)',
  zIndex: 20,
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: '24px',
  bottom: '92px',
  width: '420px',
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 120px)',
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  border: '1px solid #d7dde4',
  borderRadius: '16px',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)',
  zIndex: 20,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 16px',
  borderBottom: '1px solid #eee',
}

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '14px 16px 16px',
  overflow: 'hidden',
}

const threadStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  overflow: 'auto',
  minHeight: '180px',
  maxHeight: '280px',
}
