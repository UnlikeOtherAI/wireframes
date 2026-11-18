import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import { useAuthStore } from '../stores/authStore'
import { usePreviewMeasureStore } from '../stores/previewMeasureStore'
import '../i18n'

vi.mock('@wireframes/renderer', () => ({
  renderPage: vi.fn((_files: Record<string, string>, pageId: string) =>
    `<html><body><div id="${pageId}" class="wf-node">Rendered: ${pageId}</div></body></html>`),
  renderProject: vi.fn(() => ({ pages: new Map(), css: '', js: '', routeTable: {} })),
  parseProject: vi.fn(() => ({ documentMap: {}, pageIds: ['home'], routeIds: ['home'] })),
}))

vi.mock('../features/editor/YamlEditor', () => ({
  YamlEditor: React.forwardRef(function MockYamlEditor(
    _props: { value: string },
    ref: React.Ref<{ scrollToLine: (line: number) => void }>,
  ) {
    React.useImperativeHandle(ref, () => ({ scrollToLine: vi.fn() }))
    return React.createElement('div', { 'data-testid': 'yaml-editor' })
  }),
}))

const { ProjectEditorPage } = await import('../features/ProjectEditorPage')
const { PreviewToolbar } = await import('../features/editor/PreviewToolbar')
const { PreviewPane } = await import('../features/editor/PreviewPane')
const { WorkspacePreview } = await import('../features/workspace/WorkspacePreview')
const { Workspace } = await import('../features/workspace/Workspace')
import type { WorkspaceRef } from '../features/workspace/Workspace'

const ON = { type: 'wf:measure', on: true }
const OFF = { type: 'wf:measure', on: false }

function spyOnFrame(testId: string) {
  const frame = screen.getByTestId(testId) as HTMLIFrameElement
  return { frame, post: vi.spyOn(frame.contentWindow!, 'postMessage') }
}

function nodeClickFrom(frame: HTMLIFrameElement) {
  window.dispatchEvent(new MessageEvent('message', {
    source: frame.contentWindow,
    origin: window.location.origin,
    data: { type: 'wf:nodeClick', nodeId: 'home', address: 'wf://page/home#home' },
  }))
}

describe('Measure toggle', () => {
  it('renders a labelled ruler toggle with aria-pressed and a 44px hit target', () => {
    const onMeasureChange = vi.fn()
    const props = { device: 'web' as const, onDeviceChange: vi.fn(), renderMode: 'card' as const, onRenderModeChange: vi.fn(), onMeasureChange }
    const { rerender } = render(<PreviewToolbar {...props} measure={false} />)
    const toggle = screen.getByRole('button', { name: 'Measure' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('title', 'Show sizes and distances in the preview')
    expect(toggle.querySelector('svg')).not.toBeNull()
    expect(toggle.style.minWidth).toBe('44px')
    expect(toggle.style.minHeight).toBe('44px')
    fireEvent.click(toggle)
    expect(onMeasureChange).toHaveBeenLastCalledWith(true)

    rerender(<PreviewToolbar {...props} measure />)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    expect(onMeasureChange).toHaveBeenLastCalledWith(false)
  })
})

describe('Measure state in previews', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    usePreviewMeasureStore.setState({ measure: false })
  })

  it('WorkspacePreview replays the state on every iframe load and posts changes', () => {
    const props = { yamlFiles: {}, device: 'web' as const, renderMode: 'card' as const }
    const { rerender } = render(<WorkspacePreview {...props} activePage="home" measure />)
    const { frame, post } = spyOnFrame('workspace-preview-iframe')
    fireEvent.load(frame)
    expect(post).toHaveBeenLastCalledWith(ON, '*')

    rerender(<WorkspacePreview {...props} activePage="about" device="mobile_portrait" measure />)
    post.mockClear()
    fireEvent.load(frame)
    expect(post).toHaveBeenCalledWith(ON, '*')

    rerender(<WorkspacePreview {...props} activePage="about" device="mobile_portrait" measure={false} />)
    expect(post).toHaveBeenLastCalledWith(OFF, '*')
    fireEvent.load(frame)
    expect(post).toHaveBeenLastCalledWith(OFF, '*')
  })

  it('WorkspacePreview does not select nodes while measuring', () => {
    const onNodeSelect = vi.fn()
    const props = { yamlFiles: {}, activePage: 'home', device: 'web' as const, renderMode: 'card' as const, onNodeSelect }
    const { rerender } = render(<WorkspacePreview {...props} measure />)
    const frame = screen.getByTestId('workspace-preview-iframe') as HTMLIFrameElement
    nodeClickFrom(frame)
    expect(onNodeSelect).not.toHaveBeenCalled()

    rerender(<WorkspacePreview {...props} measure={false} />)
    nodeClickFrom(frame)
    expect(onNodeSelect).toHaveBeenCalledWith('wf://page/home#home')
  })

  it('PreviewPane replays the state into every page it writes', () => {
    const props = { error: null, device: 'web' as const }
    const { rerender } = render(<PreviewPane {...props} html="<p>one</p>" />)
    const { post } = spyOnFrame('preview-iframe')
    rerender(<PreviewPane {...props} html="<p>one</p>" measure />)
    expect(post).toHaveBeenLastCalledWith(ON, '*')
    post.mockClear()
    rerender(<PreviewPane {...props} html="<p>two</p>" measure />)
    expect(post).toHaveBeenCalledWith(ON, '*')
  })

  it('Workspace exposes setMeasure and shares the stored state with its preview', () => {
    const ref = React.createRef<WorkspaceRef>()
    render(
      <Workspace
        ref={ref}
        yamlFiles={{}}
        activePage="home"
        onPageChange={vi.fn()}
        device="web"
        onDeviceChange={vi.fn()}
        renderMode="card"
        onRenderModeChange={vi.fn()}
      />,
    )
    const { post } = spyOnFrame('workspace-preview-iframe')
    act(() => ref.current!.setMeasure(true))
    expect(usePreviewMeasureStore.getState().measure).toBe(true)
    expect(localStorage.getItem('wireframes_preview_measure')).toBe('true')
    expect(post).toHaveBeenLastCalledWith(ON, '*')
    act(() => ref.current!.setMeasure(false))
    expect(post).toHaveBeenLastCalledWith(OFF, '*')
  })
})

describe('Measure toggle in the project editor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.restoreAllMocks()
    localStorage.clear()
    usePreviewMeasureStore.setState({ measure: false })
    document.cookie = 'wf_editor_center_view=preview;path=/'
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@test.com', displayName: 'Test User', locale: 'en' },
      token: 'test-token',
      isAuthenticated: true,
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const path = String(url)
      if (/\/documents$/.test(path) || /\/documents\?/.test(path)) {
        return new Response(JSON.stringify([
          { id: 'd1', documentType: 'page', documentId: 'home', contentHash: 'h1', updatedAt: '2026-01-01T00:00:00Z' },
        ]), { status: 200 })
      }
      return new Response(JSON.stringify({
        id: 'd1', documentType: 'page', documentId: 'home',
        content: 'documentType: page\nid: home\n', contentHash: 'h1', updatedAt: '2026-01-01T00:00:00Z',
      }), { status: 200 })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('switches the mounted preview, persists, and replays after a reload', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const toggle = await screen.findByRole('button', { name: 'Measure' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    const { frame, post } = spyOnFrame('workspace-preview-iframe')

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'))
    expect(usePreviewMeasureStore.getState().measure).toBe(true)
    expect(localStorage.getItem('wireframes_preview_measure')).toBe('true')
    expect(post).toHaveBeenLastCalledWith(ON, '*')

    post.mockClear()
    fireEvent.load(frame)
    expect(post).toHaveBeenCalledWith(ON, '*')
  })
})
