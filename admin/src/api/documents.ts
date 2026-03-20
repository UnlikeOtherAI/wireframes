import { apiFetch, ApiError } from './client'

export interface DocumentSummary {
  id: string
  documentType: string
  documentId: string
  contentHash: string
  updatedAt: string
}

export interface DocumentFull extends DocumentSummary {
  content: string
}

export interface ValidationProblem {
  severity: 'error' | 'warning'
  message: string
  line?: number
  column?: number
}

export interface SaveResult {
  document: DocumentFull
  validationErrors?: ValidationProblem[]
}

export function listDocuments(projectId: string): Promise<DocumentSummary[]> {
  return apiFetch<DocumentSummary[]>(
    `/projects/${encodeURIComponent(projectId)}/documents`,
  )
}

export function getDocument(
  projectId: string,
  documentType: string,
  documentId: string,
): Promise<DocumentFull> {
  return apiFetch<DocumentFull>(
    `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentType)}/${encodeURIComponent(documentId)}`,
  )
}

export async function upsertDocument(
  projectId: string,
  documentType: string,
  documentId: string,
  content: string,
  contentHash?: string,
): Promise<SaveResult> {
  const headers: Record<string, string> = {}
  if (contentHash) {
    headers['If-Match'] = contentHash
  }

  try {
    const document = await apiFetch<DocumentFull>(
      `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentType)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ documentId, content }),
        headers,
      },
    )
    return { document }
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const parsed = tryParseJson(err.message)
      if (parsed) {
        const problems = extractValidationProblems(parsed)
        if (problems.length > 0) {
          return {
            document: { id: '', documentType, documentId, content, contentHash: '', updatedAt: '' },
            validationErrors: problems,
          }
        }
      }
    }
    throw err
  }
}

function extractValidationProblems(parsed: Record<string, unknown>): ValidationProblem[] {
  // Handle { error: "msg", details: [...] } shape (API error handler with validation details)
  if (Array.isArray(parsed.details)) {
    return (parsed.details as ValidationProblem[]).filter(
      (d) => d && typeof d.message === 'string',
    )
  }
  // Handle { errors: [...] } shape
  if (Array.isArray(parsed.errors)) {
    return (parsed.errors as ValidationProblem[]).filter(
      (d) => d && typeof d.message === 'string',
    )
  }
  // Fallback: single error message
  if (typeof parsed.error === 'string') {
    return [{ severity: 'error', message: parsed.error }]
  }
  return []
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}
