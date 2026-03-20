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
  type: string,
  content: string,
  contentHash?: string,
): Promise<SaveResult> {
  const headers: Record<string, string> = {}
  if (contentHash) {
    headers['If-Match'] = contentHash
  }

  try {
    const document = await apiFetch<DocumentFull>(
      `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(type)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
        headers,
      },
    )
    return { document }
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const parsed = tryParseJson(err.message)
      if (parsed && Array.isArray(parsed.errors)) {
        return {
          document: { id: '', documentType: type, documentId: '', content, contentHash: '', updatedAt: '' },
          validationErrors: parsed.errors,
        }
      }
    }
    throw err
  }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}
