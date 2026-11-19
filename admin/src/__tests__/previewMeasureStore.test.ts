import { describe, it, expect, beforeEach, vi } from 'vitest'

const KEY = 'wireframes_preview_measure'

async function freshStore() {
  vi.resetModules()
  return (await import('../stores/previewMeasureStore')).usePreviewMeasureStore
}

describe('preview measure store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('starts off when nothing is stored', async () => {
    const store = await freshStore()
    expect(store.getState().measure).toBe(false)
  })

  it('starts from the choice this viewer stored', async () => {
    localStorage.setItem(KEY, 'true')
    const store = await freshStore()
    expect(store.getState().measure).toBe(true)
  })

  it('persists every change', async () => {
    const store = await freshStore()
    store.getState().setMeasure(true)
    expect(localStorage.getItem(KEY)).toBe('true')
    store.getState().setMeasure(false)
    expect(localStorage.getItem(KEY)).toBe('false')
    expect(store.getState().measure).toBe(false)
  })

  it('keeps working when storage is blocked', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const store = await freshStore()
    expect(store.getState().measure).toBe(false)
    store.getState().setMeasure(true)
    expect(store.getState().measure).toBe(true)
  })
})
