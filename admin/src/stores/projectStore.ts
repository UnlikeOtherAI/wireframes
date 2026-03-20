import { create } from 'zustand'

export interface ProjectState {
  activeProjectId: string | null
  setActiveProject: (id: string | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  setActiveProject: (id) => set({ activeProjectId: id }),
}))
