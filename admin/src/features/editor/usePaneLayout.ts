import { useCallback, useRef, useState } from 'react'
import { getCookie, setCookie } from '../../utils/cookies'

type PaneName = 'nav' | 'preview' | 'chat'

const defaults = {
  nav: 240,
  preview: 420,
  chat: 360,
} as const

const limits = {
  nav: { min: 200, max: 360 },
  preview: { min: 320, max: 640 },
  chat: { min: 300, max: 480 },
} as const

function clamp(value: number, pane: PaneName): number {
  const { min, max } = limits[pane]
  return Math.max(min, Math.min(max, value))
}

function readWidth(pane: PaneName): number {
  const raw = Number(getCookie(`wf_editor_${pane}_split`))
  return Number.isFinite(raw) ? clamp(raw, pane) : defaults[pane]
}

export function usePaneLayout(chatPinned: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [navWidth, setNavWidth] = useState(() => readWidth('nav'))
  const [previewWidth, setPreviewWidth] = useState(() => readWidth('preview'))
  const [chatWidth, setChatWidth] = useState(() => readWidth('chat'))
  const navWidthRef = useRef(navWidth)
  const previewWidthRef = useRef(previewWidth)
  const chatWidthRef = useRef(chatWidth)

  navWidthRef.current = navWidth
  previewWidthRef.current = previewWidth
  chatWidthRef.current = chatWidth

  const startResize = useCallback((pane: PaneName) => (event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    event.preventDefault()

    const handleMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect()

      if (pane === 'nav') {
        const next = clamp(moveEvent.clientX - rect.left, 'nav')
        navWidthRef.current = next
        setNavWidth(next)
        return
      }

      if (pane === 'preview') {
        const rightInset = chatPinned ? chatWidthRef.current + 8 : 0
        const next = clamp(rect.right - rightInset - moveEvent.clientX, 'preview')
        previewWidthRef.current = next
        setPreviewWidth(next)
        return
      }

      const next = clamp(rect.right - moveEvent.clientX, 'chat')
      chatWidthRef.current = next
      setChatWidth(next)
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (pane === 'nav') setCookie('wf_editor_nav_split', String(navWidthRef.current))
      if (pane === 'preview') setCookie('wf_editor_preview_split', String(previewWidthRef.current))
      if (pane === 'chat') setCookie('wf_editor_chat_split', String(chatWidthRef.current))
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [chatPinned])

  return {
    containerRef,
    navWidth,
    previewWidth,
    chatWidth,
    startResize,
  }
}
