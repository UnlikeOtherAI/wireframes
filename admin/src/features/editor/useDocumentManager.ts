import { useCallback, useEffect, useRef, useState } from 'react'
import { parse as parseYaml } from 'yaml'
import {
  listDocuments,
  getDocument,
  upsertDocument,
  type DocumentSummary,
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
  documentType: string
  documentId: string
  original: string
  current: string
  contentHash: string
  problems: Problem[]
  serverProblems: Problem[]
}

export interface ActiveDoc {
  documentType: string
  documentId: string
  key: string
}

export interface ConflictInfo {
  documentType: string
  documentId: string
  localContent: string
  serverContent?: string
}

const docKey = (type: string, id: string) => `${type}:${id}`

export function useDocumentManager(projectId: string) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [activeDoc, setActiveDoc] = useState<ActiveDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  // Per-document state map keyed by `${documentType}:${documentId}`
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

  // Save a specific document by key
  const saveDocByKey = useCallback(async (key: string) => {
    const state = docStateRef.current.get(key)
    if (!state) return

    setSaveStatus('saving')

    try {
      const result = await upsertDocument(
        projectId,
        state.documentType,
        state.documentId,
        state.current,
        state.contentHash,
      )

      if (result.validationErrors && result.validationErrors.length > 0) {
        state.serverProblems = result.validationErrors
      } else {
        state.serverProblems = []
      }

      if (result.document.contentHash) {
        state.original = state.current
        state.contentHash = result.document.contentHash
        setSaveStatus('saved')
      }

      // Update visible problems
      setProblems([...state.problems, ...state.serverProblems])
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaveStatus('conflict')
        setConflict({
          documentType: state.documentType,
          documentId: state.documentId,
          localContent: state.current,
        })
        try {
          const serverDoc = await getDocument(projectId, state.documentType, state.documentId)
          setConflict({
            documentType: state.documentType,
            documentId: state.documentId,
            localContent: state.current,
            serverContent: serverDoc.content,
          })
        } catch {
          // Keep conflict without server content
        }
      } else {
        setSaveStatus('error')
      }
    }
  }, [projectId])

  // Load a specific document
  const loadDocument = useCallback(async (documentType: string, documentId: string) => {
    const key = docKey(documentType, documentId)

    // Flush any pending auto-save for the previous document before switching
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
      if (activeDoc) {
        const prevState = docStateRef.current.get(activeDoc.key)
        if (prevState && prevState.current !== prevState.original) {
          saveDocByKey(activeDoc.key)
        }
      }
    }

    const existing = docStateRef.current.get(key)
    if (existing) {
      setActiveDoc({ documentType, documentId, key })
      setProblems([...existing.problems, ...existing.serverProblems])
      setSaveStatus(existing.current !== existing.original ? 'unsaved' : 'idle')
      return
    }

    try {
      const full = await getDocument(projectId, documentType, documentId)
      const state: DocumentState = {
        documentType,
        documentId,
        original: full.content,
        current: full.content,
        contentHash: full.contentHash,
        problems: [],
        serverProblems: [],
      }
      docStateRef.current.set(key, state)
      setActiveDoc({ documentType, documentId, key })
      setProblems([])
      setSaveStatus('idle')
    } catch {
      setSaveStatus('error')
    }
  }, [projectId, activeDoc, saveDocByKey])

  const getActiveContent = useCallback((): string => {
    if (!activeDoc) return ''
    return docStateRef.current.get(activeDoc.key)?.current ?? ''
  }, [activeDoc])

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
    if (!activeDoc) return
    const key = activeDoc.key
    const state = docStateRef.current.get(key)
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

    // Debounced auto-save (3s) — keyed to the document being edited
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    if (autoSaveEnabled) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDocByKey(key)
      }, 3000)
    }
  }, [activeDoc, autoSaveEnabled, validateYaml, saveDocByKey])

  // Save the currently active document
  const saveDocument = useCallback(async () => {
    if (!activeDoc) return
    await saveDocByKey(activeDoc.key)
  }, [activeDoc, saveDocByKey])

  // Resolve conflict
  const resolveConflict = useCallback((resolution: 'local' | 'server') => {
    if (!conflict) return
    const key = docKey(conflict.documentType, conflict.documentId)
    const state = docStateRef.current.get(key)
    if (!state) return

    if (resolution === 'server' && conflict.serverContent !== undefined) {
      state.current = conflict.serverContent
      state.original = conflict.serverContent
    }
    // Clear hash to force overwrite (no If-Match)
    state.contentHash = ''
    setConflict(null)

    if (resolution === 'local') {
      // Force save immediately without If-Match
      saveDocByKey(key)
    } else {
      setSaveStatus('idle')
    }
  }, [conflict, saveDocByKey])

  const dismissConflict = useCallback(() => {
    setConflict(null)
    setSaveStatus('unsaved')
  }, [])

  const isUnsaved = useCallback((documentType: string, documentId: string): boolean => {
    const state = docStateRef.current.get(docKey(documentType, documentId))
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
    activeDoc,
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
