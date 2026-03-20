import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEVICE_VIEWPORTS, type DeviceType, type RenderMode } from './types'

interface WorkspacePreviewProps {
  yamlFiles: Record<string, string>
  activePage: string
  device: DeviceType
  renderMode: RenderMode
  onNavigate?: (routeId: string) => void
  onNodeSelect?: (address: string) => void
  highlightedNode?: string | null
}

export function WorkspacePreview({
  yamlFiles,
  activePage,
  device,
  renderMode,
  onNavigate,
  onNodeSelect,
  highlightedNode,
}: WorkspacePreviewProps) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rendererRef = useRef<typeof import('@wireframes/renderer') | null>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewport = DEVICE_VIEWPORTS[device]

  // Listen for navigation messages from the preview iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'wf:navigate' && typeof event.data.routeId === 'string') {
        onNavigate?.(event.data.routeId)
      }
      if (event.data?.type === 'wf:nodeClick' && typeof event.data.address === 'string') {
        onNodeSelect?.(event.data.address)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onNavigate, onNodeSelect])

  // Lazy-load renderer
  const getRenderer = useCallback(async () => {
    if (rendererRef.current) return rendererRef.current
    try {
      const mod = await import('@wireframes/renderer')
      rendererRef.current = mod
      return mod
    } catch {
      return null
    }
  }, [])

  const doRender = useCallback(async () => {
    if (!activePage) {
      setHtml(null)
      setError(null)
      return
    }

    const renderer = await getRenderer()
    if (!renderer) {
      setError(t('workspace.rendererUnavailable'))
      return
    }

    try {
      const result = renderer.renderPage(yamlFiles, activePage, {
        mode: renderMode,
        preview: true,
      })
      setHtml(result)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [yamlFiles, activePage, renderMode, getRenderer, t])

  // Debounced render
  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      doRender()
    }, 300)
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    }
  }, [doRender])

  // Write to iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return

    if (error) {
      doc.open()
      doc.write(buildErrorHtml(t('workspace.renderError'), error))
      doc.close()
    } else if (html) {
      doc.open()
      doc.write(html)
      doc.close()
    }
  }, [html, error, t])

  // Highlight node in iframe
  const prevHighlightRef = useRef<string | null>(null)
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return

    // Remove previous highlight
    if (prevHighlightRef.current) {
      const prev = doc.querySelector(`[data-wf-id="${CSS.escape(prevHighlightRef.current)}"]`)
      if (prev) {
        ;(prev as HTMLElement).style.outline = ''
        ;(prev as HTMLElement).style.outlineOffset = ''
      }
    }

    // Add new highlight
    if (highlightedNode) {
      const el = doc.querySelector(`[data-wf-id="${CSS.escape(highlightedNode)}"]`)
      if (el) {
        ;(el as HTMLElement).style.outline = '2px solid #1976d2'
        ;(el as HTMLElement).style.outlineOffset = '2px'
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }

    prevHighlightRef.current = highlightedNode ?? null
  }, [highlightedNode, html])

  // stable key to track content for getRenderedHtml
  const renderedHtmlRef = useRef<string | null>(null)
  renderedHtmlRef.current = html

  return (
    <div
      data-testid="workspace-preview"
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
      <div
        data-testid="workspace-device-frame"
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
          data-testid="workspace-preview-iframe"
          title={t('workspace.preview')}
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

export function useRenderedHtml(): [React.RefObject<string | null>, () => string] {
  const ref = useRef<string | null>(null)
  const getter = useCallback(() => ref.current ?? '', [])
  return [ref, getter]
}

function buildErrorHtml(title: string, message: string): string {
  const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
