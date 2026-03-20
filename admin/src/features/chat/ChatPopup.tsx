import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComment, faThumbtack, faArrowsRotate, faXmark, faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import type { ChatSessionScope } from '../../api/chat'
import {
  adminColors,
  adminRadii,
  adminShadows,
  cardSurfaceStyle,
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../../styles/adminTheme'
import { ActionButtons } from './ActionButtons'
import { DiffPreview } from './DiffPreview'
import { MarkdownMessage } from './MarkdownMessage'
import { useChatSession } from './useChatSession'

interface ChatPopupProps {
  projectId: string
  scope: ChatSessionScope
  pinned?: boolean
  defaultOpen?: boolean
  onApplyDocument: (documentType: string, documentId: string, content: string) => Promise<void>
  onPinnedChange?: (pinned: boolean) => void
}

export function ChatPopup({
  projectId,
  scope,
  pinned = false,
  defaultOpen = false,
  onApplyDocument,
  onPinnedChange,
}: ChatPopupProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(defaultOpen || pinned)
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
  } = useChatSession({ projectId, scope, isActive: isOpen || pinned, onApplyDocument })

  useEffect(() => {
    if (pinned) setIsOpen(true)
  }, [pinned])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (pinned) return
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
  const showPanel = pinned || isOpen

  function togglePinned() {
    onPinnedChange?.(!pinned)
    if (pinned) {
      setIsOpen(false)
    } else {
      setIsOpen(true)
    }
  }

  const panel = (
    <section
      aria-label={t('chat.panel')}
      data-testid={pinned ? 'chat-pinned-panel' : 'chat-popup'}
      style={pinned ? dockedPanelStyle : panelStyle}
    >
      <header style={headerStyle}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: adminColors.textPrimary }}>{t('chat.title')}</div>
          <div data-testid="chat-connection-status" style={{ fontSize: 12, color: adminColors.textTertiary }}>
            {statusLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={togglePinned}
            aria-label={pinned ? t('chat.unpin') : t('chat.pin')}
            title={pinned ? t('chat.unpin') : t('chat.pin')}
            style={headerBtnStyle}
          >
            <FontAwesomeIcon icon={faThumbtack} style={{ transform: pinned ? 'rotate(45deg)' : 'none', transition: 'transform 150ms ease' }} />
          </button>
          <button type="button" onClick={startNewConversation} title={t('chat.newConversation')} style={headerBtnStyle}>
            <FontAwesomeIcon icon={faArrowsRotate} />
          </button>
          {!pinned && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('chat.close')}
              style={headerBtnStyle}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
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
                background: message.role === 'user' ? adminColors.primaryTint : adminColors.surfaceMuted,
                borderRadius: adminRadii.button,
                padding: '10px 12px',
              }}
            >
              {message.role === 'assistant'
                ? <MarkdownMessage content={message.content || t('chat.streamingPlaceholder')} />
                : <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: adminColors.textPrimary }}>{message.content}</div>}
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
          <div role="alert" style={{ color: adminColors.dangerText, fontSize: 12, padding: '4px 0' }}>
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
          style={{ display: 'flex', gap: 8 }}
        >
          <textarea
            aria-label={t('chat.input')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            style={{
              ...inputStyle,
              flex: 1,
              resize: 'vertical',
              minHeight: 80,
            }}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            style={{
              ...primaryButtonStyle,
              minWidth: 72,
              minHeight: 44,
              padding: '8px 16px',
              opacity: (isSending || !input.trim()) ? 0.5 : 1,
              cursor: (isSending || !input.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            <FontAwesomeIcon icon={faPaperPlane} style={{ marginRight: isSending ? 0 : 4 }} />
            {isSending ? t('chat.sending') : t('chat.send')}
          </button>
        </form>
      </div>
    </section>
  )

  return (
    <>
      {!pinned && (
        <button
          type="button"
          aria-label={t('chat.open')}
          onClick={() => setIsOpen((prev) => !prev)}
          style={floatingButtonStyle}
        >
          <FontAwesomeIcon icon={faComment} style={{ fontSize: 20 }} />
        </button>
      )}

      {showPanel ? panel : null}
    </>
  )
}

const floatingButtonStyle: CSSProperties = {
  position: 'fixed',
  right: 24,
  bottom: 24,
  width: 52,
  height: 52,
  display: 'grid',
  placeItems: 'center',
  borderRadius: adminRadii.pill,
  border: 'none',
  background: adminColors.primary,
  color: '#fff',
  cursor: 'pointer',
  boxShadow: adminShadows.dropdown,
  zIndex: 20,
  transition: 'background 150ms ease',
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: 24,
  bottom: 88,
  width: 420,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 120px)',
  display: 'flex',
  flexDirection: 'column',
  ...cardSurfaceStyle,
  boxShadow: adminShadows.modal,
  zIndex: 20,
}

const dockedPanelStyle: CSSProperties = {
  ...cardSurfaceStyle,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  borderBottom: `1px solid ${adminColors.border}`,
}

const headerBtnStyle: CSSProperties = {
  ...ghostButtonStyle,
  minWidth: 'auto',
  minHeight: 32,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: adminRadii.button,
  border: `1px solid ${adminColors.border}`,
  background: adminColors.cardBg,
  color: adminColors.textSecondary,
}

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 16px 16px',
  overflow: 'hidden',
  flex: 1,
}

const threadStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  overflow: 'auto',
  minHeight: 180,
  flex: 1,
}
