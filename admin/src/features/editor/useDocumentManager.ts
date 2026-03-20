import { useCallback, useEffect, useRef, useState } from 'react'
import { parse as parseYaml } from 'yaml'
import {
  listDocuments,
  getDocument,
  upsertDocument,
  type DocumentSummary,
  type DocumentFull,
  type ValidationProblem,
} from '../../api/documents'
import { ApiError } from '../../api/client'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'conflict' | 'error'

export interface Problem {
  severity: 'error' | 'warning'
  message: string
  line?: number
  column?: number
}

interface DocumentState {
  original: string
  current: string
  contentHash: string
  problems: Problem[]
  serverProblems: Problem[]
}

export interface ConflictInfo {
  documentType: string
  localContent: string
  serverContent?: string
}

export function useDocumentManager(projectId: string) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [activeDocType, setActiveDocType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  // Per-document state map
  const docStateRef = useRef<Map<string, DocumentState>>(new Map())
  const [problems, setProblems] = useState<Problem[]>([])
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load document list
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDocuments(projectId).then((docs) => {
      if (cancelled) return
      setDocuments(docs)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [projectId])

  // Load a specific document
  const loadDocument = useCallback(async (docType: string) => {
    const existing = docStateRef.current.get(docType)
    if (existing) {
      setActiveDocType(docType)
      setProblems([...existing.problems, ...existing.serverProblems])
      setSaveStatus(existing.current !== existing.original ? 'unsaved' : 'idle')
      return
    }

    const doc = documents.find((d) => d.documentType === docType)
    if (!doc) return

    try {
      const full = await getDocument(projectId, doc.documentType, doc.documentId)
      const state: DocumentState = {
        original: full.content,
        current: full.content,
        contentHash: full.contentHash,
        problems: [],
        serverProblems: [],
      }
      docStateRef.current.set(docType, state)
      setActiveDocType(docType)
      setProblems([])
      setSaveStatus('idle')
    } catch {
      setSaveStatus('error')
    }
  }, [projectId, documents])

  const getActiveContent = useCallback((): string => {
    if (!activeDocType) return ''
    return docStateRef.current.get(activeDocType)?.current ?? ''
  }, [activeDocType])

  // Validate YAML locally
  const validateYaml = useCallback((content: string): Problem[] => {
    try {
      parseYaml(content)
      return []
    } catch (err: unknown) {
      const yamlErr = err as { message?: string; linePos?: Array<{ line: number; col: number }> }
      const line = yamlErr.linePos?.[0]?.line
      const column = yamlErr.linePos?.[0]?.col
      return [{
        severity: 'error',
        message: yamlErr.message ?? 'Invalid YAML',
        line,
        column,
      }]
    }
  }, [])

  // Handle content change
  const updateContent = useCallback((content: string) => {
    if (!activeDocType) return
    const state = docStateRef.current.get(activeDocType)
    if (!state) return

    state.current = content
    setSaveStatus('unsaved')

    // Debounced validation (500ms)
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current)
    validateTimerRef.current = setTimeout(() => {
      const localProblems = validateYaml(content)
      state.problems = localProblems
      setProblems([...localProblems, ...state.serverProblems])
    }, 500)

    // Debounced auto-save (3s)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    if (autoSaveEnabled) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDocument()
      }, 3000)
    }
  }, [activeDocType, autoSaveEnabled, validateYaml])

  // Save document
  const saveDocument = useCallback(async () => {
    if (!activeDocType) return
    const state = docStateRef.current.get(activeDocType)
    if (!state) return

    setSaveStatus('saving')

    try {
      const result = await upsertDocument(
        projectId,
        activeDocType,
        state.current,
        state.contentHash,
      )

      if (result.validationErrors && result.validationErrors.length > 0) {
        state.serverProblems = result.validationErrors
        setProblems([...state.problems, ...result.validationErrors])
      } else {
        state.serverProblems = []
        setProblems([...state.problems])
      }

      if (result.document.contentHash) {
        state.original = state.current
        state.contentHash = result.document.contentHash
        setSaveStatus('saved')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaveStatus('conflict')
        setConflict({
          documentType: activeDocType,
          localContent: state.current,
        })
        // Try to fetch server version for merge dialog
        const doc = documents.find((d) => d.documentType === activeDocType)
        if (doc) {
          try {
            const serverDoc = await getDocument(projectId, doc.documentType, doc.documentId)
            setConflict({
              documentType: activeDocType,
              localContent: state.current,
              serverContent: serverDoc.content,
            })
          } catch {
            // Keep conflict without server content
          }
        }
      } else {
        setSaveStatus('error')
      }
    }
  }, [activeDocType, projectId, documents])

  // Resolve conflict
  const resolveConflict = useCallback((resolution: 'local' | 'server') => {
    if (!conflict || !activeDocType) return
    const state = docStateRef.current.get(activeDocType)
    if (!state) return

    if (resolution === 'server' && conflict.serverContent !== undefined) {
      state.current = conflict.serverContent
      state.original = conflict.serverContent
    }
    // For 'local', we force-save (without If-Match)
    state.contentHash = '' // Clear hash to force overwrite
    setConflict(null)
    setSaveStatus('unsaved')

    if (resolution === 'local') {
      saveDocument()
    }
  }, [conflict, activeDocType, saveDocument])

  const dismissConflict = useCallback(() => {
    setConflict(null)
    setSaveStatus('unsaved')
  }, [])

  const isUnsaved = useCallback((docType: string): boolean => {
    const state = docStateRef.current.get(docType)
    if (!state) return false
    return state.current !== state.original
  }, [])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current)
    }
  }, [])

  return {
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
  }
}
