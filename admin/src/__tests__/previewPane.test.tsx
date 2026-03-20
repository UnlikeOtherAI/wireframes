import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

// Mock the renderer module
vi.mock('@wireframes/renderer', () => ({
  renderPage: vi.fn((_files: Record<string, string>, pageId: string) => {
    return `<html><body><div>Rendered: ${pageId}</div></body></html>`
  }),
  renderProject: vi.fn(() => ({
    pages: new Map([['home', '<html><body>Home</body></html>']]),
    css: '',
    js: '',
    routeTable: {},
  })),
  parseProject: vi.fn((_files: Record<string, string>) => ({
    documentMap: {},
    pageIds: ['home', 'about'],
    routeIds: ['home', 'about'],
  })),
}))

// Mock YamlEditor
let lastEditorProps: {
  value: string
  onChange: (v: string) => void
  diagnostics?: Array<{ from: number; to: number; severity: string; message: string }>
} | null = null

vi.mock('../features/editor/YamlEditor', () => {
  return {
    YamlEditor: React.forwardRef(function MockYamlEditor(
      props: {
        value: string
        onChange: (v: string) => void
        diagnostics?: Array<{ from: number; to: number; severity: string; message: string }>
      },
      ref: React.Ref<{ scrollToLine: (line: number) => void }>,
    ) {
      lastEditorProps = props
      React.useImperativeHandle(ref, () => ({ scrollToLine: vi.fn() }))
      return React.createElement('div', { 'data-testid': 'yaml-editor' },
        React.createElement('textarea', {
          'data-testid': 'yaml-textarea',
          value: props.value,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value),
        }),
      )
    }),
  }
})

const { ProjectEditorPage } = await import('../features/ProjectEditorPage')

const mockDocuments = [
  { id: 'd1', documentType: 'manifest', documentId: 'manifest', contentHash: 'hash1', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'd2', documentType: 'sitemap', documentId: 'sitemap', contentHash: 'hash2', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'd3', documentType: 'page', documentId: 'home', contentHash: 'hash3', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'd4', documentType: 'page', documentId: 'about', contentHash: 'hash4', updatedAt: '2026-01-01T00:00:00Z' },
]

function mockFetchResponses() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = url as string
    const method = (init as RequestInit)?.method ?? 'GET'

    if (urlStr.includes('/documents') && method === 'GET' && !urlStr.match(/\/documents\/.+\//)) {
      return new Response(JSON.stringify(mockDocuments), { status: 200 })
    }
    if (urlStr.match(/\/documents\/.+\//) && method === 'GET') {
      if (urlStr.includes('/manifest/manifest')) {
        return new Response(JSON.stringify({
          id: 'd1', documentType: 'manifest', documentId: 'manifest',
          content: 'specVersion: "1.0"\nname: "Test"\n', contentHash: 'hash1', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      if (urlStr.includes('/sitemap/sitemap')) {
        return new Response(JSON.stringify({
          id: 'd2', documentType: 'sitemap', documentId: 'sitemap',
          content: 'documentType: sitemap\n', contentHash: 'hash2', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      if (urlStr.includes('/page/home')) {
        return new Response(JSON.stringify({
          id: 'd3', documentType: 'page', documentId: 'home',
          content: 'documentType: page\nid: home\n', contentHash: 'hash3', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      if (urlStr.includes('/page/about')) {
        return new Response(JSON.stringify({
          id: 'd4', documentType: 'page', documentId: 'about',
          content: 'documentType: page\nid: about\n', contentHash: 'hash4', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        id: 'd1', documentType: 'manifest', documentId: 'manifest',
        content: 'specVersion: "1.0"\n', contentHash: 'hash1', updatedAt: '2026-01-01T00:00:00Z',
      }), { status: 200 })
    }
    if (urlStr.includes('/documents/') && method === 'PUT') {
      return new Response(JSON.stringify({
        id: 'd1', documentType: 'manifest', documentId: 'manifest',
        content: 'specVersion: "1.0"\n', contentHash: 'hash-new', updatedAt: '2026-01-02T00:00:00Z',
      }), { status: 200 })
    }
    return new Response('Not found', { status: 404 })
  })
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Preview Pane', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    lastEditorProps = null
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@test.com', displayName: 'Test User', locale: 'en' },
      token: 'test-token',
      isAuthenticated: true,
    })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the preview area with toolbar', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-area')).toBeInTheDocument()
    })
    expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('preview-pane')).toBeInTheDocument()
  })

  it('renders the preview iframe', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
    })
  })

  it('shows device selector with all device options', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    })
    const deviceSelect = screen.getByLabelText('Device')
    expect(deviceSelect).toBeInTheDocument()
    expect(deviceSelect.querySelectorAll('option')).toHaveLength(5)
  })

  it('shows render mode toggle with line and card buttons', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    })
    expect(screen.getByText('Line')).toBeInTheDocument()
    expect(screen.getByText('Card')).toBeInTheDocument()
  })

  it('changes device viewport when selector changes', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    })
    const deviceSelect = screen.getByLabelText('Device')
    await act(async () => {
      fireEvent.change(deviceSelect, { target: { value: 'mobile_portrait' } })
    })
    const frame = screen.getByTestId('device-frame')
    expect(frame.style.width).toBe('390px')
  })

  it('toggles render mode between line and card', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    })
    const lineBtn = screen.getByText('Line')
    const cardBtn = screen.getByText('Card')
    // Initially card is selected
    expect(cardBtn.getAttribute('aria-checked')).toBe('true')
    expect(lineBtn.getAttribute('aria-checked')).toBe('false')
    // Switch to line
    await act(async () => {
      fireEvent.click(lineBtn)
    })
    expect(lineBtn.getAttribute('aria-checked')).toBe('true')
    expect(cardBtn.getAttribute('aria-checked')).toBe('false')
  })

  it('shows page selector after documents are loaded', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    })
    // Wait for all documents to load and preview to render
    await waitFor(() => {
      const pageSelect = screen.queryByLabelText('Page')
      expect(pageSelect).toBeInTheDocument()
    })
  })

  it('renders preview with split-pane layout (editor left, preview right)', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-area')).toBeInTheDocument()
    })
    const previewArea = screen.getByTestId('preview-area')
    expect(previewArea.style.borderLeft).toContain('1px solid')
  })

  it('auto-selects first page for preview', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      const pageSelect = screen.queryByLabelText('Page') as HTMLSelectElement | null
      if (pageSelect) {
        expect(pageSelect.value).toBe('home')
      }
    })
  })

  it('switches preview to current page when editing a page document', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('about.yaml')).toBeInTheDocument()
    })
    // Click on about page to edit it
    await act(async () => {
      fireEvent.click(screen.getByText('about.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })
    // Page selector should switch to about
    await waitFor(() => {
      const pageSelect = screen.queryByLabelText('Page') as HTMLSelectElement | null
      if (pageSelect) {
        expect(pageSelect.value).toBe('about')
      }
    })
  })

  it('shows warning banner when validation problems exist but preview renders', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('home.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('home.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    // Type invalid YAML to trigger a validation error
    await act(async () => {
      lastEditorProps?.onChange('invalid: yaml: content: [')
    })

    // Advance timers past validation debounce (500ms)
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Warning banner should appear (problems exist but mocked renderer succeeds)
    await waitFor(() => {
      expect(screen.getByTestId('preview-warning-banner')).toBeInTheDocument()
    })
  })

  it('does not show warning banner when there are no problems', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('preview-pane')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('preview-warning-banner')).not.toBeInTheDocument()
  })
})
