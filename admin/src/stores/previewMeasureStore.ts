import { create } from 'zustand'

const MEASURE_KEY = 'wireframes_preview_measure'

function loadMeasure(): boolean {
  try {
    return localStorage.getItem(MEASURE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveMeasure(on: boolean): void {
  try {
    localStorage.setItem(MEASURE_KEY, String(on))
  } catch {
    // Storage can be blocked; the choice then lasts for this session only.
  }
}

export interface PreviewMeasureState {
  /** Whether previews draw the measurement overlay. Every preview iframe replays it on load. */
  measure: boolean
  setMeasure: (on: boolean) => void
}

export const usePreviewMeasureStore = create<PreviewMeasureState>((set) => ({
  measure: loadMeasure(),
  setMeasure: (on) => {
    saveMeasure(on)
    set({ measure: on })
  },
}))
