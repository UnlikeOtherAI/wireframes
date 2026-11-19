import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { stringify } from 'yaml'
import { useAuthStore } from '../stores/authStore'
import '../i18n'
import { clickRendered, clickTreeItem, loadPreview, outline, treeItems } from './previewFrame'

// The real Project Editor over a mocked document API, with the real renderer.
const { ProjectEditorPage } = await import('../features/ProjectEditorPage')

const PEOPLE = [{ id: 'ada', name: 'Ada' }, { id: 'grace', name: 'Grace' }]

// One definition row, rendered once under `core` and once under `backup`.
const documents = [
  { documentType: 'manifest', documentId: 'manifest', content: { manifest: { projectId: 'crew', name: 'Crew', schemaVersion: '1.1' } } },
  { documentType: 'sitemap', documentId: 'sitemap', content: { routes: [{ id: 'home', path: '/', page: 'home', template: 'main_template' }] } },
  { documentType: 'templates', documentId: 'templates', content: { templates: { main_template: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } } } },
  { documentType: 'components', documentId: 'components', content: { components: {
    person: { root: { id: 'person', component: 'card', children: [{ id: 'name', component: 'text', props: { text: '{{props.name}}' } }] } },
    crew: { root: { id: 'crew', component: 'stack', repeat: { cell: 'person', items: PEOPLE } } },
  } } },
  { documentType: 'page', documentId: 'home', content: { page: { id: 'home', template: 'main_template', viewport: { device: 'web' },
    slots: [{ slotId: 'main', content: [{ id: 'core', use: 'crew' }, { id: 'backup', use: 'crew' }] }] } } },
].map(({ documentType, documentId, content }, index) => ({
  id: `d${index}`, documentType, documentId, contentHash: `h${index}`, updatedAt: '2026-11-19T00:00:00Z',
  content: stringify({ specVersion: '1.1', documentType, id: documentId, ...content }),
}))

function mockDocumentApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const path = new URL(String(url), 'http://admin.test').pathname
    if (path.endsWith('/documents')) return Response.json(documents.map(({ content: _content, ...summary }) => summary))
    const found = documents.find((entry) => path.endsWith(`/documents/${entry.documentType}/${entry.documentId}`))
    return found ? Response.json(found) : new Response('Not found', { status: 404 })
  })
}

const showTab = (name: 'Tree' | 'Preview') => fireEvent.click(screen.getByRole('tab', { name }))

/** Selects the `name` descendant of the Grace row under `instance` in the tree. */
function selectGraceNameUnder(instance: 'core' | 'backup') {
  const scope = within(treeItems(instance)[0].parentElement!)
  const row = scope.getByTestId('node-tree-item-crew__grace')
  fireEvent.click(within(row).getByRole('button', { name: 'Expand' }))
  clickTreeItem(within(row.parentElement!).getByTestId('node-tree-item-name'))
}

/** Switches back to the preview, which loads the page afresh, and returns its frame once it has. */
async function backToPreview() {
  showTab('Preview')
  const frame = await loadPreview('backup__crew__grace')
  fireEvent.load(frame)
  return frame
}

async function expectOutlined(step: string, frame: HTMLIFrameElement, outlined: string, plain: string) {
  await waitFor(() => expect(outline(frame, outlined), `${step}: #${outlined} outlined`).not.toBe(''))
  expect(outline(frame, plain), `${step}: #${plain} not outlined`).toBe('')
}

describe('Project Editor outline of a row rendered under two instances', { timeout: 60000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.restoreAllMocks()
    localStorage.clear()
    document.cookie = 'wf_editor_center_view=preview;path=/'
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@test.com', displayName: 'Test User', locale: 'en' },
      token: 'test-token',
      isAuthenticated: true,
    })
    mockDocumentApi()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('outlines the row in the instance the preview or the tree selected it in', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )
    let frame = await loadPreview('backup__crew__grace')

    await clickRendered(frame, 'backup__crew__grace__name')
    await expectOutlined('preview click', frame, 'backup__crew__grace', 'core__crew__grace')

    // The preview is mounted afresh after the tree; the selection keeps its instance.
    showTab('Tree')
    frame = await backToPreview()
    await expectOutlined('preview click, after the tree', frame, 'backup__crew__grace', 'core__crew__grace')

    showTab('Tree')
    selectGraceNameUnder('core')
    frame = await backToPreview()
    await expectOutlined('tree select under core', frame, 'core__crew__grace', 'backup__crew__grace')

    showTab('Tree')
    selectGraceNameUnder('backup')
    frame = await backToPreview()
    await expectOutlined('tree select under backup', frame, 'backup__crew__grace', 'core__crew__grace')
  })
})
