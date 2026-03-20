import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faCode, faEye, faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { YamlEditor, type YamlEditorHandle } from './editor/YamlEditor'
import { DocumentTree } from './editor/DocumentTree'
import { ProblemsPanel } from './editor/ProblemsPanel'
import { ConflictDialog } from './editor/ConflictDialog'
import { CreateFileDialog } from './editor/CreateFileDialog'
import { PreviewBreadcrumb } from './editor/PreviewBreadcrumb'
import { PreviewToolbar } from './editor/PreviewToolbar'
import { useDocumentManager, type Problem } from './editor/useDocumentManager'
import {
  usePreviewRenderer,
  type DeviceType,
  type RenderMode,
} from './editor/usePreviewRenderer'
import { ChatPopup } from './chat/ChatPopup'
import { WorkspacePreview } from './workspace/WorkspacePreview'
import { NodeTree } from './workspace/NodeTree'
import { SitemapView } from './workspace/SitemapView'
import { buildNodeIdToAddressMap, useResolvedNodes, useSitemapNodes } from './workspace/useWorkspaceData'
import { buildStarterDocument } from './editor/documentTemplates'
import { ResizeHandle } from './editor/ResizeHandle'
import { buildYamlFilesMap, problemsToDiagnostics, statusStyles } from './editor/projectEditorUtils'
import { usePaneLayout } from './editor/usePaneLayout'
import { getCookie, setCookie } from '../utils/cookies'
import {
  adminColors,
  adminRadii,
  cardSurfaceStyle,
  secondaryButtonStyle,
} from '../styles/adminTheme'

type CenterView = 'source' | 'preview'

export function ProjectEditorPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const editorRef = useRef<YamlEditorHandle>(null)

  const [device, setDevice] = useState<DeviceType>(() => {
    const stored = getCookie('wf_editor_device')
    const valid: DeviceType[] = ['mobile_portrait', 'mobile_landscape', 'tablet_portrait', 'tablet_landscape', 'web', 'full_scale']
    return valid.includes(stored as DeviceType) ? stored as DeviceType : 'web'
  })
  const [renderMode, setRenderMode] = useState<RenderMode>(() => {
    const stored = getCookie('wf_editor_render_mode')
    return stored === 'line' || stored === 'card' ? stored : 'card'
  })
  const [previewPageId, setPreviewPageId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<'preview' | 'tree' | 'sitemap'>('preview')
  const [chatPinned, setChatPinned] = useState(() => getCookie('wf_editor_chat_pinned') === 'true')
  const [createFileOpen, setCreateFileOpen] = useState(false)
  const [centerView, setCenterView] = useState<CenterView>(() => {
    const stored = getCookie('wf_editor_center_view')
    return stored === 'source' || stored === 'preview' ? stored : 'preview'
  })
  const { containerRef, navWidth, chatWidth, startResize } = usePaneLayout(chatPinned)

  const handleChatPinnedChange = useCallback((nextPinned: boolean) => {
    setChatPinned(nextPinned)
    setCookie('wf_editor_chat_pinned', String(nextPinned))
  }, [])

  const handleDeviceChange = useCallback((d: DeviceType) => {
    setDevice(d)
    setCookie('wf_editor_device', d)
  }, [])

  const handleRenderModeChange = useCallback((mode: RenderMode) => {
    setRenderMode(mode)
    setCookie('wf_editor_render_mode', mode)
  }, [])

  const handleCenterViewChange = useCallback((view: CenterView) => {
    setCenterView(view)
    setCookie('wf_editor_center_view', view)
  }, [])

  const {
    documents,
    activeDoc,
    loading,
    saveStatus,
    problems,
    autoSaveEnabled,
    setAutoSaveEnabled,
    conflict,
    docStateRef,
    loadDocument,
    loadAllDocuments,
    getActiveContent,
    updateContent,
    saveDocument,
    applyDocumentContent,
    createDocument,
    resolveConflict,
    dismissConflict,
    isUnsaved,
  } = useDocumentManager(projectId ?? '')

  const [allDocsLoaded, setAllDocsLoaded] = useState(false)
  useEffect(() => {
    if (!loading && documents.length > 0 && !allDocsLoaded) {
      loadAllDocuments().then(() => setAllDocsLoaded(true))
    }
  }, [loading, documents, allDocsLoaded, loadAllDocuments])

  useEffect(() => {
    if (allDocsLoaded && previewPageId === null) {
      const firstPage = documents.find((d) => d.documentType === 'page')
      if (firstPage) setPreviewPageId(firstPage.documentId)
    }
  }, [allDocsLoaded, previewPageId, documents])

  useEffect(() => {
    if (activeDoc?.documentType === 'page') {
      setPreviewPageId(activeDoc.documentId)
    }
  }, [activeDoc])

  const { previewState, scheduleRender } = usePreviewRenderer(
    docStateRef,
    documents,
    previewPageId,
    device,
    renderMode,
  )

  const content = getActiveContent()
  const yamlFiles = useMemo(() => buildYamlFilesMap(docStateRef.current), [docStateRef, documents, previewState])
  const resolvedNodes = useResolvedNodes(yamlFiles, previewPageId ?? '')
  const sitemapNodes = useSitemapNodes(yamlFiles)
  const nodeIdToAddress = useMemo(() => buildNodeIdToAddressMap(resolvedNodes), [resolvedNodes])

  const diagnostics = useMemo(
    () => problemsToDiagnostics(problems, content),
    [problems, content],
  )

  const handleClickProblem = useCallback((problem: Problem) => {
    if (problem.line && editorRef.current) {
      editorRef.current.scrollToLine(problem.line)
    }
  }, [])

  const handleSave = useCallback(() => {
    saveDocument()
  }, [saveDocument])

  const handleContentChange = useCallback((value: string) => {
    updateContent(value)
    scheduleRender()
  }, [updateContent, scheduleRender])

  const handlePreviewNavigate = useCallback((routeId: string) => {
    const page = documents.find(
      (d) => d.documentType === 'page' && d.documentId === routeId,
    )
    if (page) {
      setPreviewPageId(page.documentId)
      setSelectedNode(null)
    }
  }, [documents])

  const handleApplyChatDocument = useCallback(async (
    documentType: string,
    documentId: string,
    nextContent: string,
  ) => {
    await applyDocumentContent(documentType, documentId, nextContent)
    scheduleRender()
  }, [applyDocumentContent, scheduleRender])

  const handleCreateDocument = useCallback(async (documentType: string, documentId: string) => {
    await createDocument(
      documentType,
      documentId,
      buildStarterDocument(documentType, documentId),
    )
    scheduleRender()
  }, [createDocument, scheduleRender])

  const displayStatus = activeDoc && saveStatus === 'idle' && isUnsaved(activeDoc.documentType, activeDoc.documentId)
    ? 'unsaved'
    : saveStatus

  if (!projectId) return null

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{t('editor.title')}</h1>
        <div aria-busy="true" aria-label={t('common.loading')} style={{ color: adminColors.textSecondary }}>
          {t('common.loading')}
        </div>
      </main>
    )
  }

  const tabStyle = (mode: 'preview' | 'tree' | 'sitemap') => ({
    border: workspaceMode === mode ? 'none' : `1px solid ${adminColors.border}`,
    borderRadius: adminRadii.pill,
    background: workspaceMode === mode ? adminColors.primary : adminColors.cardBg,
    color: workspaceMode === mode ? '#fff' : adminColors.textPrimary,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500 as const,
    cursor: 'pointer' as const,
    minHeight: 32,
  })

  const chatScope = {
    projectId,
    activePage: previewPageId ?? undefined,
    selectedNode: selectedNode ?? undefined,
    workspaceMode,
    device,
    renderMode,
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Editor toolbar */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/" aria-label={t('editor.backToDashboard')} style={iconButtonStyle}>
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 14 }} />
          </Link>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: adminColors.textPrimary }}>
            {t('editor.title')}
          </h1>

          {/* Source / Preview toggle */}
          <div style={viewToggleContainerStyle}>
            <button
              type="button"
              aria-label={t('editor.viewSource')}
              data-testid="view-source-btn"
              onClick={() => handleCenterViewChange('source')}
              style={viewToggleBtnStyle(centerView === 'source')}
            >
              <FontAwesomeIcon icon={faCode} />
            </button>
            <button
              type="button"
              aria-label={t('editor.viewPreview')}
              data-testid="view-preview-btn"
              onClick={() => handleCenterViewChange('preview')}
              style={viewToggleBtnStyle(centerView === 'preview')}
            >
              <FontAwesomeIcon icon={faEye} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: adminColors.textSecondary }}>
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              aria-label={t('editor.autoSave')}
            />
            {t('editor.autoSave')}
          </label>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || !activeDoc}
            style={{
              ...secondaryButtonStyle,
              minHeight: 36,
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: (saveStatus === 'saving' || !activeDoc) ? 0.5 : 1,
              cursor: (saveStatus === 'saving' || !activeDoc) ? 'not-allowed' : 'pointer',
            }}
          >
            <FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: 13 }} />
            {saveStatus === 'saving' ? t('editor.saving') : t('common.save')}
          </button>
          {displayStatus !== 'idle' && (
            <span
              data-testid="save-status"
              style={{ fontSize: 13, fontWeight: 500, ...statusStyles[displayStatus] }}
            >
              {t(`editor.status.${displayStatus}`)}
            </span>
          )}
        </div>
      </header>

      {/* Workspace panes */}
      <div ref={containerRef} style={workspaceStyle}>
        {/* Document tree pane */}
        <div style={{ width: navWidth, flexShrink: 0, ...cardSurfaceStyle, overflow: 'hidden' }}>
          <DocumentTree
            documents={documents}
            activeDocType={activeDoc?.documentType ?? null}
            activeDocId={activeDoc?.documentId ?? null}
            onSelect={(type, id) => { loadDocument(type, id) }}
            isUnsaved={isUnsaved}
            onNewFile={() => setCreateFileOpen(true)}
          />
        </div>
        <ResizeHandle testId="resize-nav-handle" onMouseDown={startResize('nav')} />

        {/* Center content area — toggles between source and preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...cardSurfaceStyle }}>
          {centerView === 'source' ? (
            /* Source code view */
            activeDoc ? (
              <>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <YamlEditor
                    ref={editorRef}
                    value={content}
                    onChange={handleContentChange}
                    diagnostics={diagnostics}
                  />
                </div>
                <ProblemsPanel
                  problems={problems}
                  onClickProblem={handleClickProblem}
                />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: adminColors.textTertiary, fontSize: 14 }}>
                {t('editor.selectDocument')}
              </div>
            )
          ) : (
            /* Preview view */
            <div data-testid="preview-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <PreviewToolbar
                device={device}
                onDeviceChange={handleDeviceChange}
                renderMode={renderMode}
                onRenderModeChange={handleRenderModeChange}
              />
              <PreviewBreadcrumb
                pageId={previewPageId}
                templateName={previewState.templateName}
                routePath={previewState.routePath}
              />
              <div
                role="tablist"
                aria-label={t('chat.scopeMode')}
                style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${adminColors.border}` }}
              >
                {(['preview', 'tree', 'sitemap'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={workspaceMode === mode}
                    onClick={() => setWorkspaceMode(mode)}
                    style={tabStyle(mode)}
                  >
                    {mode === 'preview' ? t('preview.title') : t(`workspace.tab${mode === 'tree' ? 'Tree' : 'Sitemap'}`)}
                  </button>
                ))}
              </div>
              {workspaceMode === 'preview' && (
                <div data-testid="preview-pane" style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
                  {problems.length > 0 && (
                    <div
                      data-testid="preview-warning-banner"
                      role="alert"
                      style={{
                        padding: '8px 12px',
                        background: adminColors.warningBg,
                        borderBottom: `1px solid ${adminColors.warningBorder}`,
                        color: adminColors.warningText,
                        fontSize: 13,
                      }}
                    >
                      {t('preview.validationWarnings')}
                    </div>
                  )}
                  <WorkspacePreview
                    yamlFiles={yamlFiles}
                    activePage={previewPageId ?? ''}
                    device={device}
                    renderMode={renderMode}
                    onNavigate={handlePreviewNavigate}
                    onNodeSelect={setSelectedNode}
                    highlightedNode={selectedNode}
                    nodeIdToAddress={nodeIdToAddress}
                  />
                </div>
              )}
              {workspaceMode === 'tree' && (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <NodeTree
                    nodes={resolvedNodes}
                    onNodeSelect={setSelectedNode}
                    selectedNode={selectedNode}
                  />
                </div>
              )}
              {workspaceMode === 'sitemap' && (
                <SitemapView
                  nodes={sitemapNodes}
                  activePage={previewPageId ?? ''}
                  onPageChange={handlePreviewNavigate}
                />
              )}
            </div>
          )}
        </div>

        {/* Pinned chat pane */}
        {chatPinned && (
          <>
            <ResizeHandle testId="resize-chat-handle" onMouseDown={startResize('chat')} />
            <div style={{ width: chatWidth, flexShrink: 0 }}>
              <ChatPopup
                projectId={projectId}
                pinned
                onPinnedChange={handleChatPinnedChange}
                scope={chatScope}
                onApplyDocument={handleApplyChatDocument}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals and overlays */}
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={resolveConflict}
          onDismiss={dismissConflict}
        />
      )}
      <CreateFileDialog
        open={createFileOpen}
        documents={documents}
        onClose={() => setCreateFileOpen(false)}
        onCreateDocument={handleCreateDocument}
      />
      {!chatPinned && (
        <ChatPopup
          projectId={projectId}
          pinned={false}
          onPinnedChange={handleChatPinnedChange}
          scope={chatScope}
          onApplyDocument={handleApplyChatDocument}
        />
      )}
    </main>
  )
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 16px',
  borderBottom: `1px solid ${adminColors.border}`,
  minHeight: 48,
  background: adminColors.cardBg,
}

const iconButtonStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 36,
  height: 36,
  borderRadius: adminRadii.button,
  border: `1px solid ${adminColors.border}`,
  background: adminColors.cardBg,
  color: adminColors.textSecondary,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background 150ms ease',
}

const viewToggleContainerStyle: React.CSSProperties = {
  display: 'flex',
  background: adminColors.surfaceMuted,
  borderRadius: adminRadii.pill,
  padding: 2,
  gap: 2,
  marginLeft: 4,
}

function viewToggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 28,
    borderRadius: adminRadii.pill,
    border: 'none',
    background: active ? adminColors.cardBg : 'transparent',
    color: active ? adminColors.primary : adminColors.textTertiary,
    cursor: 'pointer',
    fontSize: 13,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    transition: 'all 150ms ease',
  }
}

const workspaceStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  gap: 8,
  padding: 12,
  background: adminColors.pageBg,
}
