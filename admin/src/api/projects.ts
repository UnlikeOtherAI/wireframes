import { apiFetch } from './client'

export interface Project {
  id: string
  name: string
  role: string
  createdAt: string
  updatedAt: string
}

export function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/projects')
}

export function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${encodeURIComponent(id)}`)
}

export function createProject(name: string): Promise<Project> {
  return apiFetch<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function renameProject(id: string, name: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
