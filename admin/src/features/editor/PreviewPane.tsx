import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeviceType } from './usePreviewRenderer'
import { DEVICE_VIEWPORTS } from './usePreviewRenderer'

interface PreviewPaneProps {
  html: string | null
  error: string | null
  hasWarnings?: boolean
  device: DeviceType
  onNavigate?: (routeId: string) => void
}

export function PreviewPane({ html, error, hasWarnings, device, onNavigate }: PreviewPaneProps) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const viewport = DEVICE_VIEWPORTS[device]

  // Listen for navigation messages from the preview iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type === 'wf:navigate' && typeof event.data.routeId === 'string') {
        onNavigate?.(event.data.routeId)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onNavigate])

  // Write HTML to iframe
  const writeToIframe = useCallback((content: string) => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(content)
    doc.close()
  }, [])

  useEffect(() => {
    if (error) {
      writeToIframe(buildErrorHtml(t('preview.yamlError'), error))
    } else if (html) {
      writeToIframe(html)
    } else {
      writeToIframe(buildPlaceholderHtml(t('preview.selectPage')))
    }
  }, [html, error, writeToIframe, t])

  const showWarningBanner = hasWarnings && html && !error

  return (
    <div
      data-testid="preview-pane"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'auto',
        background: '#f0f0f0',
        padding: '16px',
      }}
    >
      {showWarningBanner && (
        <div
          data-testid="preview-warning-banner"
          role="alert"
          style={{
            width: '100%',
            maxWidth: viewport.width,
            padding: '8px 12px',
            marginBottom: '8px',
            background: '#fff8e1',
            border: '1px solid #ffe082',
            borderRadius: '4px',
            color: '#6d4c00',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span aria-hidden="true">{'\u26A0'}</span>
          {t('preview.validationWarnings')}
        </div>
      )}
      <div
        data-testid="device-frame"
        style={{
          width: viewport.width,
          minHeight: viewport.minHeight,
          border: '2px solid #ccc',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          flexShrink: 0,
        }}
      >
        <iframe
          ref={iframeRef}
          data-testid="preview-iframe"
          title={t('preview.title')}
          sandbox="allow-scripts"
          style={{
            width: '100%',
            height: viewport.minHeight,
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}

function buildErrorHtml(title: string, message: string): string {
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html><head><style>
body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
.error { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; color: #991b1b; }
.error-title { font-weight: 600; margin-bottom: 8px; }
.error-message { font-size: 13px; white-space: pre-wrap; word-break: break-word; }
</style></head><body>
<div class="error">
  <div class="error-title">${escapedTitle}</div>
  <div class="error-message">${escapedMessage}</div>
</div>
</body></html>`
}

function buildPlaceholderHtml(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html><head><style>
body { font-family: system-ui, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; color: #888; }
</style></head><body>
<div>${escaped}</div>
</body></html>`
}
