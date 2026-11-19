import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { parse, stringify } from 'yaml'
import '../i18n'
// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
import * as addressing from '../../../engine/addressing/index.js'

// The real renderer renders these pages: nothing here stubs the preview.
const { Workspace } = await import('../features/workspace/Workspace')

type Row = { ok: boolean; targetType?: string; item: Record<string, unknown>; index: number; error?: string }
const { parseAddress, buildPageRoots, buildComponentRootsFromMap, resolveAddressInRoots } = addressing as {
  parseAddress: (address: string) => { ok: boolean; doctype: string; documentId: string; pathSegments: string[] }
  buildPageRoots: (pageDoc: unknown, pageId: string) => { ok: boolean; roots: unknown[] }
  buildComponentRootsFromMap: (components: unknown, id: string) => { ok: boolean; roots: unknown[] }
  resolveAddressInRoots: (roots: unknown[], segments: string[]) => Row
}

const doc = (value: Record<string, unknown>) => stringify({ specVersion: '1.1', ...value })

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Admin' },
  { id: 'grace', name: 'Grace Hopper', role: 'Editor' },
  { id: 'alan', name: 'Alan Turing', role: 'Viewer' },
]

const components = {
  documentType: 'components',
  id: 'components',
  components: {
    person_card: {
      propDefaults: { role: 'Member' },
      root: { id: 'person_card', component: 'card', children: [
        { id: 'name', component: 'heading', props: { text: '{{props.name}}', level: 3 } },
        { id: 'role', component: 'text', props: { text: '{{props.role}}' } },
      ] },
    },
    team_section: {
      root: { id: 'team_section', component: 'section', props: { title: 'Core team' }, children: [
        { id: 'team', component: 'grid', layout: { type: 'grid', columns: 3 }, repeat: { cell: 'person_card', items: PEOPLE } },
      ] },
    },
  },
}

function files(pageItems = PEOPLE, componentDoc: Record<string, unknown> = components): Record<string, string> {
  return {
    'manifest.yaml': doc({ documentType: 'manifest', id: 'manifest', manifest: { projectId: 'rows', name: 'Rows', schemaVersion: '1.1' } }),
    'sitemap.yaml': doc({ documentType: 'sitemap', id: 'sitemap', routes: [{ id: 'home', path: '/', page: 'home', template: 'main_template' }] }),
    'templates.yaml': doc({ documentType: 'templates', id: 'templates',
      templates: { main_template: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } } }),
    'components.yaml': doc(componentDoc),
    'pages/home.yaml': doc({ documentType: 'page', id: 'home', page: { id: 'home', template: 'main_template', viewport: { device: 'web' }, slots: [{
      slotId: 'main',
      content: [
        { id: 'kpis', component: 'row', repeat: { cell: 'stat', items: [{ id: 'mrr', label: 'MRR', value: '$1k' }] } },
        { id: 'team', component: 'grid', layout: { type: 'grid', columns: 3 }, repeat: { cell: 'person_card', items: pageItems } },
        { id: 'core', use: 'team_section' },
      ],
    }] } }),
  }
}

function workspace(yamlFiles: Record<string, string>, onNodeSelect: (address: string) => void) {
  return (
    <Workspace
      yamlFiles={yamlFiles}
      activePage="home"
      onPageChange={vi.fn()}
      device="web"
      onDeviceChange={vi.fn()}
      renderMode="card"
      onRenderModeChange={vi.fn()}
      showTree
      onNodeSelect={onNodeSelect}
    />
  )
}

/** Waits for the rendered page, then loads it into the frame as a browser loads `srcdoc`. */
async function loadPreview(expected: string) {
  const frame = screen.getByTestId('workspace-preview-iframe') as HTMLIFrameElement
  await waitFor(() => expect(frame.getAttribute('srcdoc') ?? '').toContain(expected), { timeout: 15000 })
  const page = frame.contentDocument!
  page.open()
  page.write(frame.getAttribute('srcdoc')!)
  page.close()
  const view = frame.contentWindow as unknown as { HTMLElement: typeof HTMLElement }
  view.HTMLElement.prototype.scrollIntoView = () => {}
  return frame
}

/** Clicks a rendered node and delivers what the page's own click bridge posts. */
async function clickRendered(frame: HTMLIFrameElement, renderedId: string) {
  const posted: unknown[] = []
  const capture = (event: MessageEvent) => {
    if (event.data?.type === 'wf:nodeClick') posted.push(event.data)
  }
  window.addEventListener('message', capture)
  const target = frame.contentDocument!.getElementById(renderedId)
  expect(target, `rendered #${renderedId}`).not.toBeNull()
  const view = frame.contentWindow as unknown as { MouseEvent: typeof MouseEvent }
  target!.dispatchEvent(new view.MouseEvent('click', { bubbles: true }))
  await waitFor(() => expect(posted.length).toBeGreaterThan(0))
  window.removeEventListener('message', capture)
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: posted.at(-1) }))
  })
}

function selectInTree(id: string) {
  const item = screen.getAllByTestId(`node-tree-item-${id}`)[0]
  fireEvent.click(within(item).getAllByRole('button').at(-1)!)
}

/** The item an address names, found the way `wf node` finds it, in the document it is written in. */
function itemAt(yamlFiles: Record<string, string>, address: string) {
  const parsed = parseAddress(address)
  const roots = parsed.doctype === 'page'
    ? buildPageRoots(parse(yamlFiles['pages/home.yaml']), 'home')
    : buildComponentRootsFromMap(parse(yamlFiles['components.yaml']).components, parsed.documentId)
  const resolved = resolveAddressInRoots(roots.roots, parsed.pathSegments)
  expect(resolved.ok, resolved.error).toBe(true)
  expect(resolved.targetType).toBe('repeat-item')
  return resolved
}

/** The files with the item an address names edited, and the items then reordered, as an author would. */
function editThenReorder(yamlFiles: Record<string, string>, address: string, edit: Record<string, unknown>, order: string[]) {
  const file = address.startsWith('wf://page/') ? 'pages/home.yaml' : 'components.yaml'
  const parsed = parseAddress(address)
  const document = parse(yamlFiles[file])
  const roots = file === 'pages/home.yaml'
    ? buildPageRoots(document, 'home')
    : buildComponentRootsFromMap(document.components, parsed.documentId)
  const row = resolveAddressInRoots(roots.roots, parsed.pathSegments)
  Object.assign(row.item, edit)
  const host = file === 'pages/home.yaml'
    ? document.page.slots[0].content[1]
    : document.components.team_section.root.children[0]
  host.repeat.items = order.map((id) => host.repeat.items.find((item: { id: string }) => item.id === id))
  return { ...yamlFiles, [file]: stringify(document) }
}

describe('Workspace selection of repeat rows', { timeout: 30000 }, () => {
  it('lists rows under their host, labelled with their item', async () => {
    render(workspace(files(), vi.fn()))
    await loadPreview('team__grace')
    const tree = screen.getByTestId('workspace-node-tree')
    expect(within(tree).getByTestId('node-tree-item-team__grace').textContent).toContain('item grace')
    expect(within(tree).getByTestId('node-tree-item-kpis__mrr').textContent).toContain('stat')
  })

  it('selects a page row by its row id, and its internals select the row, after a reorder too', async () => {
    const onNodeSelect = vi.fn()
    const initial = files()
    const { rerender } = render(workspace(initial, onNodeSelect))
    const frame = await loadPreview('Grace Hopper')
    await clickRendered(frame, 'team__grace')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.team.team__grace')
    await clickRendered(frame, 'team__ada__name')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.team.team__ada')
    selectInTree('team__alan')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.team.team__alan')

    const edited = editThenReorder(initial, 'wf://page/home#main.team.team__grace', { role: 'Owner' }, ['grace', 'alan', 'ada'])
    rerender(workspace(edited, onNodeSelect))
    const refreshed = await loadPreview('Owner')
    await clickRendered(refreshed, 'team__grace')
    const address = onNodeSelect.mock.lastCall![0] as string
    expect(address).toBe('wf://page/home#main.team.team__grace')
    const row = itemAt(edited, address)
    expect(row.index).toBe(0)
    expect(row.item).toEqual({ id: 'grace', name: 'Grace Hopper', role: 'Owner' })
    selectInTree('team__grace')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.team.team__grace')
  })

  it('selects a row of a component-owned repeat in its definition, after a reorder too', async () => {
    const onNodeSelect = vi.fn()
    const initial = files()
    const { rerender } = render(workspace(initial, onNodeSelect))
    const frame = await loadPreview('core__team__grace')
    const rowAddress = 'wf://component/team_section#team_section.team.team__grace'
    await clickRendered(frame, 'core__team__grace')
    expect(onNodeSelect).toHaveBeenLastCalledWith(rowAddress)
    await clickRendered(frame, 'core__team__grace__role')
    expect(onNodeSelect).toHaveBeenLastCalledWith(rowAddress)
    await clickRendered(frame, 'core')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.core')

    const edited = editThenReorder(initial, rowAddress, { name: 'Grace B. Hopper' }, ['alan', 'grace', 'ada'])
    rerender(workspace(edited, onNodeSelect))
    const refreshed = await loadPreview('Grace B. Hopper')
    await clickRendered(refreshed, 'core__team__grace__name')
    expect(onNodeSelect).toHaveBeenLastCalledWith(rowAddress)
    const row = itemAt(edited, rowAddress)
    expect(row.index).toBe(1)
    expect(row.item.name).toBe('Grace B. Hopper')
    // The definition's host sits below the instance, collapsed until opened.
    const tree = screen.getByTestId('workspace-node-tree')
    const hosts = within(tree).getAllByTestId('node-tree-item-team')
    expect(hosts).toHaveLength(2)
    fireEvent.click(within(hosts[1]).getByRole('button', { name: 'Expand' }))
    const items = within(tree).getAllByTestId('node-tree-item-team__grace')
    expect(items).toHaveLength(2)
    fireEvent.click(within(items[1]).getAllByRole('button').at(-1)!)
    expect(onNodeSelect).toHaveBeenLastCalledWith(rowAddress)
  })
})
