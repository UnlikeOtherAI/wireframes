import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentSummary } from '../../api/documents'

export type DeviceType =
  | 'web'
  | 'tablet_portrait'
  | 'tablet_landscape'
  | 'mobile_portrait'
  | 'mobile_landscape'

export interface DeviceViewport {
  width: number
  minHeight: number
  label: string
}

export const DEVICE_VIEWPORTS: Record<DeviceType, DeviceViewport> = {
  web: { width: 1280, minHeight: 900, label: 'Web' },
  tablet_portrait: { width: 820, minHeight: 1180, label: 'Tablet Portrait' },
  tablet_landscape: { width: 1180, minHeight: 820, label: 'Tablet Landscape' },
  mobile_portrait: { width: 390, minHeight: 844, label: 'Mobile Portrait' },
  mobile_landscape: { width: 844, minHeight: 390, label: 'Mobile Landscape' },
}

export type RenderMode = 'line' | 'card'

export interface PreviewState {
  html: string | null
  error: string | null
  pageIds: string[]
  templateName: string | null
  routePath: string | null
}

interface DocumentState {
  documentType: string
  documentId: string
  current: string
}

function extractBreadcrumb(
  docStates: Map<string, DocumentState>,
  pageId: string,
): { templateName: string | null; routePath: string | null } {
  // Try to find template name from the page doc
  let templateName: string | null = null
  const pageState = docStates.get(`page:${pageId}`)
  if (pageState) {
    const templateMatch = pageState.current.match(/template:\s*["']?(\S+?)["']?\s*(?:\n|$)/)
    if (templateMatch) templateName = templateMatch[1]
  }

  // Try to find route path from sitemap
  let routePath: string | null = null
  const sitemapState = docStates.get('sitemap:sitemap')
  if (sitemapState) {
    const routePattern = new RegExp(
      `- id:\\s*${pageId}[\\s\\S]*?path:\\s*["']?([^"'\\n]+?)["']?\\s*(?:\\n|$)` +
      `|path:\\s*["']?([^"'\\n]+?)["']?\\s*(?:\\n)[\\s\\S]*?(?:page|id):\\s*${pageId}`,
    )
    const routeMatch = sitemapState.current.match(routePattern)
    if (routeMatch) routePath = routeMatch[1] || routeMatch[2] || null
  }

  return { templateName, routePath }
}

function buildYamlFilesMap(
  docStates: Map<string, DocumentState>,
): Record<string, string> {
  const files: Record<string, string> = {}
  for (const [, state] of docStates) {
    const { documentType, documentId, current } = state
    if (documentType === 'page') {
      files[`pages/${documentId}.yaml`] = current
    } else if (documentType === 'dataset') {
      files[`data/${documentId}.yaml`] = current
    } else {
      files[`${documentType}.yaml`] = current
    }
  }
  return files
}

export function usePreviewRenderer(
  docStateRef: React.RefObject<Map<string, DocumentState>>,
  documents: DocumentSummary[],
  activePageId: string | null,
  device: DeviceType,
  renderMode: RenderMode,
) {
  const [previewState, setPreviewState] = useState<PreviewState>({
    html: null,
    error: null,
    pageIds: [],
    templateName: null,
    routePath: null,
  })
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rendererRef = useRef<typeof import('@wireframes/renderer') | null>(null)
  const loadingRef = useRef(false)

  // Lazy-load the renderer module
  const getRenderer = useCallback(async () => {
    if (rendererRef.current) return rendererRef.current
    if (loadingRef.current) return null
    loadingRef.current = true
    try {
      const mod = await import('@wireframes/renderer')
      rendererRef.current = mod
      return mod
    } catch {
      return null
    } finally {
      loadingRef.current = false
    }
  }, [])

  const doRender = useCallback(async () => {
    const empty: PreviewState = { html: null, error: null, pageIds: [], templateName: null, routePath: null }

    if (!activePageId) {
      setPreviewState(empty)
      return
    }

    const docStates = docStateRef.current
    if (!docStates || docStates.size === 0) {
      setPreviewState(empty)
      return
    }

    const renderer = await getRenderer()
    if (!renderer) {
      setPreviewState({ ...empty, error: 'Renderer library not available' })
      return
    }

    const yamlFiles = buildYamlFilesMap(docStates)

    // Extract breadcrumb info from loaded docs
    const breadcrumb = extractBreadcrumb(docStates, activePageId)

    try {
      const parsed = renderer.parseProject(yamlFiles)
      const html = renderer.renderPage(yamlFiles, activePageId, {
        mode: renderMode,
        preview: true,
      })
      setPreviewState({
        html,
        error: null,
        pageIds: parsed.pageIds,
        ...breadcrumb,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setPreviewState((prev) => ({
        ...prev,
        error: message,
        ...breadcrumb,
      }))
    }
  }, [activePageId, renderMode, docStateRef, getRenderer])

  // Re-render on mode/device/page changes (immediate)
  useEffect(() => {
    doRender()
  }, [doRender])

  // Debounced re-render on content change (300ms)
  const scheduleRender = useCallback(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      doRender()
    }, 300)
  }, [doRender])

  // Cleanup
  useEffect(() => {
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    }
  }, [])

  return {
    previewState,
    scheduleRender,
  }
}
