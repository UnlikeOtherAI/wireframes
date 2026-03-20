import { apiFetch } from './client'

export interface Document {
  type: string
  content: string
  updatedAt: string
}

export function listDocuments(projectId: string): Promise<Document[]> {
  return apiFetch<Document[]>(
    `/projects/${encodeURIComponent(projectId)}/documents`,
  )
}

export function upsertDocument(
  projectId: string,
  type: string,
  content: string,
): Promise<Document> {
  return apiFetch<Document>(
    `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(type)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ content }),
    },
  )
}
