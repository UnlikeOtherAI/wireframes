import { useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { YamlEditor, type YamlEditorHandle } from './editor/YamlEditor'
import { DocumentTree } from './editor/DocumentTree'
import { ProblemsPanel } from './editor/ProblemsPanel'
import { ConflictDialog } from './editor/ConflictDialog'
import { useDocumentManager, type Problem } from './editor/useDocumentManager'
import type { Diagnostic } from '@codemirror/lint'

function lineColToPos(doc: string, line: number, col: number): number {
  let pos = 0
  let currentLine = 1
  for (let i = 0; i < doc.length; i++) {
    if (currentLine === line) {
      return pos + Math.min(col - 1, doc.length - pos)
    }
    if (doc[i] === '\n') {
      currentLine++
    }
    pos++
  }
  return pos
}

function problemsToDiagnostics(problems: Problem[], docContent: string): Diagnostic[] {
  return problems.map((p) => {
    let from = 0
    let to = 0
    if (p.line != null && p.line > 0) {
      from = lineColToPos(docContent, p.line, p.column ?? 1)
      // Underline the rest of the line or at least one char
      const lineEnd = docContent.indexOf('\n', from)
      to = lineEnd === -1 ? docContent.length : lineEnd
      if (to === from) to = Math.min(from + 1, docContent.length)
    }
    return {
      from,
      to,
      severity: p.severity === 'warning' ? ('warning' as const) : ('error' as const),
      message: p.message,
    }
  })
}

const STATUS_STYLES: Record<string, { color: string }> = {
  saving: { color: '#888' },
  saved: { color: '#4caf50' },
  unsaved: { color: '#f57c00' },
  error: { color: '#d32f2f' },
  conflict: { color: '#d32f2f' },
}

export function ProjectEditorPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const editorRef = useRef<YamlEditorHandle>(null)

  const {
    documents,
    activeDocType,
    loading,
    saveStatus,
    problems,
    autoSaveEnabled,
    setAutoSaveEnabled,
    conflict,
    loadDocument,
    getActiveContent,
    updateContent,
    saveDocument,
    resolveConflict,
    dismissConflict,
    isUnsaved,
  } = useDocumentManager(projectId ?? '')

  const content = getActiveContent()

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

  if (!projectId) return null

  if (loading) {
    return (
      <main>
        <h1>{t('editor.title')}</h1>
        <div aria-busy="true" aria-label={t('common.loading')}>
          {t('common.loading')}
        </div>
      </main>
    )
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Toolbar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
          borderBottom: '1px solid #ddd',
          minHeight: '48px',
        }}
      >
        <h1 style={{ fontSize: '16px', margin: 0, flex: 1 }}>{t('editor.title')}</h1>

        {/* Auto-save toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => setAutoSaveEnabled(e.target.checked)}
            aria-label={t('editor.autoSave')}
          />
          {t('editor.autoSave')}
        </label>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !activeDocType}
          style={{
            padding: '6px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: '#fff',
            cursor: 'pointer',
            minHeight: '36px',
          }}
        >
          {saveStatus === 'saving' ? t('editor.saving') : t('common.save')}
        </button>

        {/* Save status */}
        {saveStatus !== 'idle' && (
          <span
            data-testid="save-status"
            style={{
              fontSize: '13px',
              ...STATUS_STYLES[saveStatus],
            }}
          >
            {t(`editor.status.${saveStatus}`)}
          </span>
        )}
      </header>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Document tree sidebar */}
        <DocumentTree
          documents={documents}
          activeDocType={activeDocType}
          onSelect={loadDocument}
          isUnsaved={isUnsaved}
        />

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeDocType ? (
            <>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <YamlEditor
                  ref={editorRef}
                  value={content}
                  onChange={updateContent}
                  diagnostics={diagnostics}
                />
              </div>
              <ProblemsPanel
                problems={problems}
                onClickProblem={handleClickProblem}
              />
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
              }}
            >
              {t('editor.selectDocument')}
            </div>
          )}
        </div>
      </div>

      {/* Conflict Dialog */}
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={resolveConflict}
          onDismiss={dismissConflict}
        />
      )}
    </main>
  )
}
