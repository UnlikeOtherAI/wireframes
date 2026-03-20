import { apiFetch } from './client'

export interface PreviewSettings {
  slug: string | null
  url: string | null
  accessMode: 'public' | 'password' | 'sso'
  publishedAt: string | null
  emailAccessList: string[]
}

export function getPreviewSettings(projectId: string): Promise<PreviewSettings> {
  return apiFetch<PreviewSettings>(
    `/projects/${encodeURIComponent(projectId)}/preview`,
  )
}

export function updatePreviewSettings(
  projectId: string,
  settings: { accessMode?: string; password?: string; emails?: string[] },
): Promise<PreviewSettings> {
  return apiFetch<PreviewSettings>(
    `/projects/${encodeURIComponent(projectId)}/preview`,
    {
      method: 'PATCH',
      body: JSON.stringify(settings),
    },
  )
}

export function publishPreview(
  projectId: string,
): Promise<PreviewSettings> {
  return apiFetch<PreviewSettings>(
    `/projects/${encodeURIComponent(projectId)}/preview`,
    { method: 'POST' },
  )
}
