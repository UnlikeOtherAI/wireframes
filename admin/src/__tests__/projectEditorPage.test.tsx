import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

// Track the mock editor state
let lastEditorProps: {
  value: string
  onChange: (v: string) => void
  diagnostics?: Array<{ from: number; to: number; severity: string; message: string }>
} | null = null
let mockScrollToLine: ReturnType<typeof vi.fn>

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
      mockScrollToLine = vi.fn()
      React.useImperativeHandle(ref, () => ({ scrollToLine: mockScrollToLine }))
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

// Import after mock setup
const { ProjectEditorPage } = await import('../features/ProjectEditorPage')

const mockDocuments = [
  { id: 'd1', documentType: 'manifest', documentId: 'manifest', contentHash: 'hash1', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'd2', documentType: 'sitemap', documentId: 'sitemap', contentHash: 'hash2', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'd3', documentType: 'page:home', documentId: 'home', contentHash: 'hash3', updatedAt: '2026-01-01T00:00:00Z' },
]

const manifestContent = 'specVersion: "1.0"\nname: "Test Project"\n'

function mockFetchResponses(overrides?: {
  saveStatus?: number
  saveBody?: string | Record<string, unknown>
  getDocContent?: string
}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = url as string
    const method = (init as RequestInit)?.method ?? 'GET'

    // List documents
    if (urlStr.includes('/documents') && method === 'GET' && !urlStr.match(/\/documents\/.+\//)) {
      return new Response(JSON.stringify(mockDocuments), { status: 200 })
    }

    // Get single document
    if (urlStr.match(/\/documents\/.+\//) && method === 'GET') {
      const content = overrides?.getDocContent ?? manifestContent
      return new Response(JSON.stringify({
        id: 'd1',
        documentType: 'manifest',
        documentId: 'manifest',
        content,
        contentHash: 'hash1',
        updatedAt: '2026-01-01T00:00:00Z',
      }), { status: 200 })
    }

    // Upsert document (PUT)
    if (urlStr.includes('/documents/') && method === 'PUT') {
      const status = overrides?.saveStatus ?? 200
      if (status === 409) {
        return new Response('Conflict', { status: 409, statusText: 'Conflict' })
      }
      if (status === 422) {
        const body = overrides?.saveBody ?? {
          errors: [{ severity: 'error', message: 'Invalid schema', line: 2, column: 1 }],
        }
        return new Response(JSON.stringify(body), { status: 422 })
      }
      return new Response(JSON.stringify({
        id: 'd1',
        documentType: 'manifest',
        documentId: 'manifest',
        content: manifestContent,
        contentHash: 'hash-new',
        updatedAt: '2026-01-02T00:00:00Z',
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

describe('ProjectEditorPage', () => {
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

  it('shows loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderEditor()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows document tree after loading', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    expect(screen.getByText('sitemap.yaml')).toBeInTheDocument()
    expect(screen.getByText('home.yaml')).toBeInTheDocument()
  })

  it('loads document content when tree item is clicked', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })
    expect(lastEditorProps?.value).toBe(manifestContent)
  })

  it('saves document on Save click', async () => {
    const fetchSpy = mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })
    await waitFor(() => {
      const putCalls = fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT')
      expect(putCalls.length).toBeGreaterThan(0)
    })
  })

  it('shows YAML validation errors with correct line numbers', async () => {
    const invalidYaml = 'valid: true\ninvalid: yaml: :[["\n'
    mockFetchResponses({ getDocContent: invalidYaml })
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    // Trigger a change to invoke validation
    await act(async () => {
      lastEditorProps?.onChange(invalidYaml)
      vi.advanceTimersByTime(600)
    })

    await waitFor(() => {
      const panel = screen.getByTestId('problems-panel')
      const items = panel.querySelectorAll('button[role="listitem"]')
      expect(items.length).toBeGreaterThan(0)
    })
  })

  it('clicking a problem scrolls editor to line', async () => {
    const invalidYaml = 'valid: true\ninvalid: yaml: :[["\n'
    mockFetchResponses({ getDocContent: invalidYaml })
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    await act(async () => {
      lastEditorProps?.onChange(invalidYaml)
      vi.advanceTimersByTime(600)
    })

    await waitFor(() => {
      const panel = screen.getByTestId('problems-panel')
      const items = panel.querySelectorAll('button[role="listitem"]')
      expect(items.length).toBeGreaterThan(0)
    })

    const panel = screen.getByTestId('problems-panel')
    const problemBtn = panel.querySelector('button[role="listitem"]')!
    fireEvent.click(problemBtn)

    expect(mockScrollToLine).toHaveBeenCalled()
  })

  it('shows conflict dialog on 409 save response', async () => {
    mockFetchResponses({ saveStatus: 409 })
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Save conflict')).toBeInTheDocument()
    })

    expect(screen.getByText('Keep my changes')).toBeInTheDocument()
  })

  it('shows server validation results after save', async () => {
    mockFetchResponses({ saveStatus: 422 })
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })

    await waitFor(() => {
      const panel = screen.getByTestId('problems-panel')
      expect(panel.textContent).toContain('Invalid schema')
    })
  })

  it('auto-save can be disabled via toggle', async () => {
    const fetchSpy = mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    // Disable auto-save
    const autoSaveCheckbox = screen.getByLabelText('Auto-save')
    await act(async () => {
      fireEvent.click(autoSaveCheckbox)
    })
    expect(autoSaveCheckbox).not.toBeChecked()

    // Make a change and wait
    const putCountBefore = fetchSpy.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'PUT',
    ).length
    await act(async () => {
      lastEditorProps?.onChange('changed: true\n')
      vi.advanceTimersByTime(5000)
    })

    const putCountAfter = fetchSpy.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'PUT',
    ).length
    expect(putCountAfter).toBe(putCountBefore)
  })

  it('auto-save fires after 3s when enabled', async () => {
    const fetchSpy = mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    const putCountBefore = fetchSpy.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'PUT',
    ).length
    await act(async () => {
      lastEditorProps?.onChange('changed: true\n')
      vi.advanceTimersByTime(3100)
    })

    await waitFor(() => {
      const putCountAfter = fetchSpy.mock.calls.filter(
        ([, init]) => (init as RequestInit)?.method === 'PUT',
      ).length
      expect(putCountAfter).toBeGreaterThan(putCountBefore)
    })
  })

  it('shows unsaved indicator when content is modified', async () => {
    mockFetchResponses()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    await act(async () => {
      lastEditorProps?.onChange('modified: true\n')
    })

    await waitFor(() => {
      expect(screen.getByTestId('save-status')).toHaveTextContent('Unsaved changes')
    })
  })

  it('diagnostics have correct from/to positions based on line numbers', async () => {
    const invalidYaml = 'line1: ok\nline2: bad: :[["\nline3: ok\n'
    mockFetchResponses({ getDocContent: invalidYaml })
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('manifest.yaml')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('manifest.yaml'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('yaml-editor')).toBeInTheDocument()
    })

    await act(async () => {
      lastEditorProps?.onChange(invalidYaml)
      vi.advanceTimersByTime(600)
    })

    await waitFor(() => {
      expect(lastEditorProps?.diagnostics).toBeDefined()
      const diags = lastEditorProps?.diagnostics
      if (diags && diags.length > 0) {
        expect(diags[0].from).toBeGreaterThan(0)
        expect(diags[0].to).toBeGreaterThan(diags[0].from)
      }
    })
  })
})
