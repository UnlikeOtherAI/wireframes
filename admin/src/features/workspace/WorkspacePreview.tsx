import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEVICE_VIEWPORTS, type DeviceType, type RenderMode } from './types'
import { postMeasure } from './postMeasure'
import { loadRenderer } from './rendererModule'

interface WorkspacePreviewProps {
  yamlFiles: Record<string, string>
  activePage: string
  device: DeviceType
  renderMode: RenderMode
  onNavigate?: (routeId: string) => void
  onNodeSelect?: (address: string) => void
  highlightedNode?: string | null
  /** The rendered node the highlighted selection was made on, when it renders more than once. */
  highlightedRenderedId?: string | null
  interactive?: boolean
  onHtmlChange?: (html: string) => void
  zoom?: number
  nodeIdToAddress?: Map<string, string>
  measure?: boolean
}

export function WorkspacePreview({
  yamlFiles,
  activePage,
  device,
  renderMode,
  onNavigate,
  onNodeSelect,
  highlightedNode,
  highlightedRenderedId,
  interactive = true,
  onHtmlChange,
  zoom = 100,
  nodeIdToAddress,
  measure = false,
}: WorkspacePreviewProps) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [srcdoc, setSrcdoc] = useState<string>('')
  // The selection a click in the preview made, and the rendered node it outlines.
  const [clicked, setClicked] = useState<{ address: string; renderedId: string } | null>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewport = DEVICE_VIEWPORTS[device]
  const scale = zoom / 100
  const measureRef = useRef(measure)

  // Every load is a fresh page, so the desired measure state is replayed on
  // load as well as whenever it changes.
  useEffect(() => {
    measureRef.current = measure
    postMeasure(iframeRef.current, measure)
  }, [measure])

  // Listen for messages from the preview iframe. The srcdoc page shares this
  // window's origin, so a message from anywhere else is not the preview's,
  // even when it comes from the frame's browsing context.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'wf:navigate' && typeof event.data.routeId === 'string') {
        onNavigate?.(event.data.routeId)
      }
      if (event.data?.type === 'wf:nodeClick' && !measureRef.current) {
        const selection = clickedSelection(event.data, nodeIdToAddress, activePage)
        if (selection) {
          setClicked(selection)
          onNodeSelect?.(selection.address)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onNavigate, onNodeSelect, nodeIdToAddress, activePage])

  const doRender = useCallback(async () => {
    if (!activePage) {
      setHtml(null)
      setError(null)
      return
    }

    const renderer = await loadRenderer()
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
  }, [yamlFiles, activePage, renderMode, t])

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
      let processed = fixPreviewAssetPaths(html)
      processed = injectNodeClickBridge(processed, interactive)
      setSrcdoc(processed)
    } else {
      setSrcdoc('')
    }
  }, [html, error, t, interactive])

  // Outline the selected node in the page. Node ids render as element ids.
  const highlightedRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    if (highlightedRef.current) {
      highlightedRef.current.style.outline = ''
      highlightedRef.current.style.outlineOffset = ''
    }
    const anchor = highlightedRenderedId ?? (clicked?.address === highlightedNode ? clicked?.renderedId : null)
    const el = highlightedNode ? selectionElement(doc, highlightedNode, nodeIdToAddress, anchor ?? null) : null
    if (el) {
      el.style.outline = '2px solid #1976d2'
      el.style.outlineOffset = '2px'
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    highlightedRef.current = el
  }, [highlightedNode, highlightedRenderedId, clicked, nodeIdToAddress, html])

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
          onLoad={() => postMeasure(iframeRef.current, measureRef.current)}
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

const FA_CDN_URL = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.2.0/css/all.min.css'

function fixPreviewAssetPaths(html: string): string {
  return html.replace(
    /href="[^"]*\/_shared\/fa\/css\/all\.min\.css"/g,
    `href="${FA_CDN_URL}"`,
  )
}

function lastSegment(address: string): string | null {
  const hashIdx = address.indexOf('#')
  const parts = (hashIdx >= 0 ? address.slice(hashIdx + 1) : address).split('.')
  return parts[parts.length - 1] || null
}

/**
 * The element a selection outlines. A selected node renders as itself; a
 * component's internal node selects its owner, so the owner is outlined: the
 * outermost element around the anchor that selects the same address. The
 * anchor is the rendered node the selection was made on; without one, the
 * first rendering of the address is used, since a definition's node renders
 * once per instance. Without a node map, the address's last id is the
 * element id.
 */
function selectionElement(
  doc: Document,
  address: string,
  nodeIdToAddress: Map<string, string> | undefined,
  anchorId: string | null,
): HTMLElement | null {
  const byId = (id: string | null) => (id ? doc.getElementById(id) : null)
  if (!nodeIdToAddress) return byId(lastSegment(address))
  let el = byId(anchorId)
  if (!el || nodeIdToAddress.get(el.id) !== address) {
    el = null
    for (const [id, selects] of nodeIdToAddress) {
      el = selects === address ? byId(id) : null
      if (el) break
    }
  }
  if (!el) return byId(lastSegment(address))
  for (let up = el.parentElement?.closest<HTMLElement>('.wf-node[id]'); up; up = up.parentElement?.closest<HTMLElement>('.wf-node[id]')) {
    const selects = nodeIdToAddress.get(up.id)
    if (selects === address) el = up
    else if (selects !== undefined) break
  }
  return el
}

const NODE_ID = /^[a-z][a-z0-9_]*$/

/**
 * What a click in the preview selects, and the rendered node it selects
 * through. The page reports the clicked node and the rendered nodes around it,
 * innermost first; the first one the node tree knows wins. A node rendered
 * inside an imported or built-in component is not in the tree, so its click
 * lands on the closest page-authored instance. The page's own message never
 * names the address. Without a node map (a bare preview) only a well-formed
 * node id on this page is selected.
 */
function clickedSelection(
  data: { nodeId?: unknown; ancestorIds?: unknown },
  nodeIdToAddress: Map<string, string> | undefined,
  activePage: string,
): { address: string; renderedId: string } | null {
  if (typeof data.nodeId !== 'string') return null
  if (nodeIdToAddress) {
    const around = Array.isArray(data.ancestorIds) ? data.ancestorIds : []
    for (const id of [data.nodeId, ...around]) {
      const address = typeof id === 'string' ? nodeIdToAddress.get(id) : undefined
      if (address) return { address, renderedId: id as string }
    }
    return null
  }
  return NODE_ID.test(data.nodeId) ? { address: `wf://page/${activePage}#${data.nodeId}`, renderedId: data.nodeId } : null
}

function injectNodeClickBridge(html: string, interactive: boolean): string {
  if (!interactive) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
  }

  const bridge = `<script>
(function(){
  document.addEventListener('click', function(e) {
    var ids = [];
    for (var el = e.target; el && el !== document.body; el = el.parentElement) {
      if (el.id && el.classList && el.classList.contains('wf-node')) ids.push(el.id);
    }
    if (ids.length === 0) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wf:nodeClick', nodeId: ids[0], ancestorIds: ids.slice(1) }, '*');
      }
    } catch(_e){}
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
