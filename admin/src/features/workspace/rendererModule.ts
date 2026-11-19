import { useEffect, useState } from 'react'

export type RendererModule = typeof import('@wireframes/renderer')

// The renderer is the engine, bundled for the browser. It loads on first use,
// once, and the preview and the node tree share it.
let loaded: RendererModule | null = null
let pending: Promise<RendererModule | null> | null = null

/** The renderer module, or null when it cannot be loaded; a later call tries again. */
export function loadRenderer(): Promise<RendererModule | null> {
  pending ??= import('@wireframes/renderer').then(
    (mod) => (loaded = mod),
    () => {
      pending = null
      return null
    },
  )
  return pending
}

/** The renderer once it has loaded: `undefined` while loading, null when it cannot load. */
export function useRenderer(): RendererModule | null | undefined {
  const [renderer, setRenderer] = useState<RendererModule | null | undefined>(loaded ?? undefined)
  useEffect(() => {
    if (renderer !== undefined) return
    let current = true
    loadRenderer().then((mod) => {
      if (current) setRenderer(mod)
    })
    return () => {
      current = false
    }
  }, [renderer])
  return renderer
}
