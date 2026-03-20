import { useCallback, useEffect, useRef, useState } from 'react'
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
  interactive?: boolean
  onHtmlChange?: (html: string) => void
  zoom?: number
  nodeIdToAddress?: Map<string, string>
}

export function WorkspacePreview({
  yamlFiles,
  activePage,
  device,
  renderMode,
  onNavigate,
  onNodeSelect,
  highlightedNode,
  interactive = true,
  onHtmlChange,
  zoom = 100,
  nodeIdToAddress,
}: WorkspacePreviewProps) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [srcdoc, setSrcdoc] = useState<string>('')
  const rendererRef = useRef<typeof import('@wireframes/renderer') | null>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewport = DEVICE_VIEWPORTS[device]
  const scale = zoom / 100

  // Listen for messages from the preview iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type === 'wf:navigate' && typeof event.data.routeId === 'string') {
        onNavigate?.(event.data.routeId)
      }
      if (event.data?.type === 'wf:nodeClick' && typeof event.data.nodeId === 'string') {
        const resolvedAddress = nodeIdToAddress?.get(event.data.nodeId)
          ?? event.data.address
          ?? `wf://page/${activePage}#${event.data.nodeId}`
        onNodeSelect?.(resolvedAddress)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onNavigate, onNodeSelect, nodeIdToAddress, activePage])

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

  // Report rendered HTML to parent
  useEffect(() => {
    onHtmlChange?.(html ?? '')
  }, [html, onHtmlChange])

  // Build srcdoc content for the iframe
  useEffect(() => {
    if (error) {
      setSrcdoc(buildErrorHtml(t('workspace.renderError'), error))
    } else if (html) {
      setSrcdoc(injectNodeClickBridge(html, activePage, interactive))
    } else {
      setSrcdoc('')
    }
  }, [html, error, t, activePage, interactive])

  // Highlight node in iframe — uses HTML id attr (engine renders node IDs as id attrs)
  const prevHighlightRef = useRef<string | null>(null)
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return

    // Remove previous highlight
    if (prevHighlightRef.current) {
      const nodeId = extractNodeIdFromAddress(prevHighlightRef.current)
      if (nodeId) {
        const prev = doc.getElementById(nodeId)
        if (prev) {
          prev.style.outline = ''
          prev.style.outlineOffset = ''
        }
      }
    }

    // Add new highlight
    if (highlightedNode) {
      const nodeId = extractNodeIdFromAddress(highlightedNode)
      if (nodeId) {
        const el = doc.getElementById(nodeId)
        if (el) {
          el.style.outline = '2px solid #1976d2'
          el.style.outlineOffset = '2px'
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }
    }

    prevHighlightRef.current = highlightedNode ?? null
  }, [highlightedNode, html])

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
          width: viewport.width * scale,
          minHeight: viewport.minHeight * scale,
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
          sandbox={interactive ? 'allow-scripts allow-same-origin' : undefined}
          srcDoc={srcdoc || undefined}
          style={{
            width: viewport.width,
            height: viewport.minHeight,
            border: 'none',
            display: 'block',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  )
}

function extractNodeIdFromAddress(address: string): string | null {
  const hashIdx = address.indexOf('#')
  if (hashIdx >= 0) {
    const path = address.slice(hashIdx + 1)
    const parts = path.split('.')
    return parts[parts.length - 1] || null
  }
  return address || null
}

function injectNodeClickBridge(html: string, activePage: string, interactive: boolean): string {
  if (!interactive) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
  }

  const bridge = `<script>
(function(){
  var PAGE_ID = ${JSON.stringify(activePage)};
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.id && el.classList && el.classList.contains('wf-node')) {
        var address = 'wf://page/' + PAGE_ID + '#' + el.id;
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'wf:nodeClick', address: address, nodeId: el.id }, '*');
          }
        } catch(_e){}
        break;
      }
      el = el.parentElement;
    }
  });
})();
</script>`
  return html.replace('</body>', bridge + '\n</body>')
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
