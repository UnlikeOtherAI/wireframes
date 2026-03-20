import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeviceType, RenderMode } from './types'
import { PageNavigation } from './PageNavigation'
import { DeviceControls } from './DeviceControls'
import { NodeTree } from './NodeTree'
import { SitemapView } from './SitemapView'
import { WorkspacePreview } from './WorkspacePreview'
import { useResolvedNodes, useSitemapNodes } from './useWorkspaceData'

export interface WorkspaceProps {
  yamlFiles: Record<string, string>
  assets?: Record<string, string>

  activePage: string
  onPageChange: (pageId: string) => void
  device: DeviceType
  onDeviceChange: (device: DeviceType) => void
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void

  showNavigation?: boolean
  showDeviceControls?: boolean
  showTree?: boolean
  interactive?: boolean

  onNodeSelect?: (address: string) => void
  onNavigate?: (routeId: string) => void

  pageIds?: string[]
}

export interface WorkspaceRef {
  navigateTo(pageId: string): void
  setDevice(device: DeviceType): void
  setMode(mode: RenderMode): void
  highlightNode(address: string): void
  getRenderedHtml(): string
  refresh(): void
}

export const Workspace = forwardRef<WorkspaceRef, WorkspaceProps>(function Workspace(
  {
    yamlFiles,
    activePage,
    onPageChange,
    device,
    onDeviceChange,
    renderMode,
    onRenderModeChange,
    showNavigation = true,
    showDeviceControls = true,
    showTree = false,
    interactive = true,
    onNodeSelect,
    onNavigate,
    pageIds: externalPageIds,
  },
  ref,
) {
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [zoom, setZoom] = useState(100)
  const renderedHtmlRef = useRef('')

  const resolvedNodes = useResolvedNodes(yamlFiles, activePage)
  const sitemapNodes = useSitemapNodes(yamlFiles)

  // Derive page IDs from yamlFiles if not provided externally
  const pageIds = externalPageIds ?? derivePageIds(yamlFiles)

  const handleNodeSelect = useCallback(
    (address: string) => {
      setHighlightedNode(address)
      onNodeSelect?.(address)
    },
    [onNodeSelect],
  )

  const handleNavigate = useCallback(
    (routeId: string) => {
      onNavigate?.(routeId)
      onPageChange(routeId)
    },
    [onNavigate, onPageChange],
  )

  const handleHtmlChange = useCallback((html: string) => {
    renderedHtmlRef.current = html
  }, [])

  // Imperative ref methods
  useImperativeHandle(
    ref,
    () => ({
      navigateTo(pageId: string) {
        onPageChange(pageId)
      },
      setDevice(d: DeviceType) {
        onDeviceChange(d)
      },
      setMode(m: RenderMode) {
        onRenderModeChange(m)
      },
      highlightNode(address: string) {
        setHighlightedNode(address)
      },
      getRenderedHtml() {
        return renderedHtmlRef.current
      },
      refresh() {
        setRefreshKey((k) => k + 1)
      },
    }),
    [onPageChange, onDeviceChange, onRenderModeChange],
  )

  return (
    <div
      data-testid="workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Device controls bar */}
      {showDeviceControls && (
        <DeviceControls
          device={device}
          onDeviceChange={onDeviceChange}
          renderMode={renderMode}
          onRenderModeChange={onRenderModeChange}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      )}

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Page navigation sidebar */}
        {showNavigation && (
          <PageNavigation
            pageIds={pageIds}
            activePage={activePage}
            onPageChange={onPageChange}
          />
        )}

        {/* Preview */}
        <WorkspacePreview
          key={refreshKey}
          yamlFiles={yamlFiles}
          activePage={activePage}
          device={device}
          renderMode={renderMode}
          onNavigate={handleNavigate}
          onNodeSelect={handleNodeSelect}
          highlightedNode={highlightedNode}
          interactive={interactive}
          onHtmlChange={handleHtmlChange}
          zoom={zoom}
        />

        {/* Right panel: Node tree or Sitemap */}
        {showTree && (
          <div
            data-testid="workspace-right-panel"
            style={{
              width: '260px',
              borderLeft: '1px solid #ddd',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <TreeSitemapTabs
              resolvedNodes={resolvedNodes}
              sitemapNodes={sitemapNodes}
              activePage={activePage}
              onPageChange={onPageChange}
              onNodeSelect={handleNodeSelect}
              selectedNode={highlightedNode}
            />
          </div>
        )}
      </div>
    </div>
  )
})

function derivePageIds(yamlFiles: Record<string, string>): string[] {
  const ids: string[] = []
  for (const key of Object.keys(yamlFiles)) {
    if (key.startsWith('pages/') && key.endsWith('.yaml')) {
      ids.push(key.slice(6, -5))
    }
  }
  ids.sort((a, b) => a.localeCompare(b))
  return ids
}

interface TreeSitemapTabsProps {
  resolvedNodes: import('./types').ResolvedNode[]
  sitemapNodes: import('./types').SitemapNode[]
  activePage: string
  onPageChange: (pageId: string) => void
  onNodeSelect: (address: string) => void
  selectedNode: string | null
}

function TreeSitemapTabs({
  resolvedNodes,
  sitemapNodes,
  activePage,
  onPageChange,
  onNodeSelect,
  selectedNode,
}: TreeSitemapTabsProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'tree' | 'sitemap'>('tree')

  return (
    <>
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid #ddd',
          minHeight: '36px',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'tree'}
          data-testid="tab-tree"
          onClick={() => setActiveTab('tree')}
          style={{
            flex: 1,
            border: 'none',
            background: activeTab === 'tree' ? '#fff' : '#f5f5f5',
            borderBottom: activeTab === 'tree' ? '2px solid #1976d2' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeTab === 'tree' ? 600 : 400,
            padding: '8px 4px',
          }}
        >
          {t('workspace.tabTree')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'sitemap'}
          data-testid="tab-sitemap"
          onClick={() => setActiveTab('sitemap')}
          style={{
            flex: 1,
            border: 'none',
            background: activeTab === 'sitemap' ? '#fff' : '#f5f5f5',
            borderBottom: activeTab === 'sitemap' ? '2px solid #1976d2' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeTab === 'sitemap' ? 600 : 400,
            padding: '8px 4px',
          }}
        >
          {t('workspace.tabSitemap')}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'tree' ? (
          <NodeTree
            nodes={resolvedNodes}
            onNodeSelect={onNodeSelect}
            selectedNode={selectedNode}
          />
        ) : (
          <SitemapView
            nodes={sitemapNodes}
            activePage={activePage}
            onPageChange={onPageChange}
          />
        )}
      </div>
    </>
  )
}
