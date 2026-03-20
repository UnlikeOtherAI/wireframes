import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

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

const manifestContent = 'specVersion: "1.0"\nname: "Test Project"\n'
const homeContent = 'title: "Home Page"\nlayout: stack\n'
const aboutContent = 'title: "About Page"\nlayout: row\n'

function mockFetchDefault(overrides?: { saveStatus?: number; saveBody?: Record<string, unknown> }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = url as string
    const method = (init as RequestInit)?.method ?? 'GET'

    if (urlStr.includes('/documents') && method === 'GET' && !urlStr.match(/\/documents\/.+\//)) {
      return new Response(JSON.stringify(mockDocuments), { status: 200 })
    }
    if (urlStr.match(/\/documents\/.+\//) && method === 'GET') {
      if (urlStr.includes('/page/home')) {
        return new Response(JSON.stringify({
          id: 'd3', documentType: 'page', documentId: 'home',
          content: homeContent, contentHash: 'hash3', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      if (urlStr.includes('/page/about')) {
        return new Response(JSON.stringify({
          id: 'd4', documentType: 'page', documentId: 'about',
          content: aboutContent, contentHash: 'hash4', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        id: 'd1', documentType: 'manifest', documentId: 'manifest',
        content: manifestContent, contentHash: 'hash1', updatedAt: '2026-01-01T00:00:00Z',
      }), { status: 200 })
    }
    if (urlStr.includes('/documents/') && method === 'PUT') {
      const status = overrides?.saveStatus ?? 200
      if (status === 409) {
        return new Response('Conflict', { status: 409, statusText: 'Conflict' })
      }
      if (status === 422) {
        const body = overrides?.saveBody ?? {
          error: 'Validation failed',
          details: [{ severity: 'error', message: 'Invalid schema', line: 2, column: 1 }],
        }
        return new Response(JSON.stringify(body), { status: 422 })
      }
      return new Response(JSON.stringify({
        id: 'd1', documentType: 'manifest', documentId: 'manifest',
        content: manifestContent, contentHash: 'hash-new', updatedAt: '2026-01-02T00:00:00Z',
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

describe('ProjectEditorPage — save, conflict, and document identity', () => {
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

  it('shows conflict dialog on 409 save response', async () => {
    mockFetchDefault({ saveStatus: 409 })
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

  it('force-save from conflict dialog triggers actual save', async () => {
    let saveCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url as string
      const method = (init as RequestInit)?.method ?? 'GET'

      if (urlStr.includes('/documents') && method === 'GET' && !urlStr.match(/\/documents\/.+\//)) {
        return new Response(JSON.stringify(mockDocuments), { status: 200 })
      }
      if (urlStr.match(/\/documents\/.+\//) && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'd1', documentType: 'manifest', documentId: 'manifest',
          content: manifestContent, contentHash: 'hash1', updatedAt: '2026-01-01T00:00:00Z',
        }), { status: 200 })
      }
      if (urlStr.includes('/documents/') && method === 'PUT') {
        saveCount++
        if (saveCount === 1) {
          return new Response('Conflict', { status: 409, statusText: 'Conflict' })
        }
        return new Response(JSON.stringify({
          id: 'd1', documentType: 'manifest', documentId: 'manifest',
          content: manifestContent, contentHash: 'hash-force', updatedAt: '2026-01-02T00:00:00Z',
        }), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

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
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Keep my changes'))
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(saveCount).toBe(2)
    })
  })

  it('shows server validation errors from 422 with { error, details }', async () => {
    mockFetchDefault({
      saveStatus: 422,
      saveBody: {
        error: 'Validation failed',
        details: [{ severity: 'error', message: 'Invalid schema', line: 2, column: 1 }],
      },
    })
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
      expect(screen.getByTestId('problems-panel').textContent).toContain('Invalid schema')
    })
  })

  it('shows server validation errors from 422 with { error } only', async () => {
    mockFetchDefault({
      saveStatus: 422,
      saveBody: { error: 'Malformed YAML document' },
    })
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
      expect(screen.getByTestId('problems-panel').textContent).toContain('Malformed YAML document')
    })
  })

  it('auto-save can be disabled via toggle', async () => {
    const fetchSpy = mockFetchDefault()
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
    const autoSaveCheckbox = screen.getByLabelText('Auto-save')
    await act(async () => {
      fireEvent.click(autoSaveCheckbox)
    })
    expect(autoSaveCheckbox).not.toBeChecked()

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
    const fetchSpy = mockFetchDefault()
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

  it('two page documents with same type have independent unsaved state', async () => {
    mockFetchDefault()
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText('home.yaml')).toBeInTheDocument()
    })
    // Disable auto-save so flush on switch doesn't save
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Auto-save'))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('home.yaml'))
    })
    await waitFor(() => {
      expect(lastEditorProps?.value).toBe(homeContent)
    })
    await act(async () => {
      lastEditorProps?.onChange('modified home\n')
    })

    const homeBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('home.yaml'))!
    expect(homeBtn.querySelector('[aria-label="unsaved changes"]')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByText('about.yaml'))
    })
    await waitFor(() => {
      expect(lastEditorProps?.value).toBe(aboutContent)
    })

    const aboutBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('about.yaml'))!
    expect(aboutBtn.querySelector('[aria-label="unsaved changes"]')).toBeFalsy()

    const homeBtn2 = screen.getAllByRole('button').find((b) => b.textContent?.includes('home.yaml'))!
    expect(homeBtn2.querySelector('[aria-label="unsaved changes"]')).toBeTruthy()
  })

  it('auto-save flushes pending save on document switch', async () => {
    const fetchSpy = mockFetchDefault()
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
      lastEditorProps?.onChange('changed: true\n')
    })

    const putCountBefore = fetchSpy.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'PUT',
    ).length

    await act(async () => {
      fireEvent.click(screen.getByText('home.yaml'))
    })

    await waitFor(() => {
      const putCountAfter = fetchSpy.mock.calls.filter(
        ([, init]) => (init as RequestInit)?.method === 'PUT',
      ).length
      expect(putCountAfter).toBeGreaterThan(putCountBefore)
    })
  })
})
