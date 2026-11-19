import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { parse, stringify } from 'yaml'
import '../i18n'
// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
import * as addressing from '../../../engine/addressing/index.js'

// The real renderer renders these pages: nothing here stubs the preview.
const { Workspace } = await import('../features/workspace/Workspace')

type Resolved = { ok: boolean; targetType?: string; item: Record<string, unknown>; index: number; error?: string }
const { parseAddress, buildPageRoots, buildTemplateRoots, buildComponentRootsFromMap, resolveAddressInRoots } = addressing as {
  parseAddress: (address: string) => { ok: boolean; doctype: string; documentId: string; pathSegments: string[] }
  buildPageRoots: (pageDoc: unknown, pageId: string) => { ok: boolean; roots: unknown[] }
  buildTemplateRoots: (template: unknown, templateId: string) => { ok: boolean; roots: unknown[] }
  buildComponentRootsFromMap: (components: unknown, id: string) => { ok: boolean; roots: unknown[] }
  resolveAddressInRoots: (roots: unknown[], segments: string[]) => Resolved
}

const doc = (value: Record<string, unknown>) => stringify({ specVersion: '1.1', ...value })

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Admin' },
  { id: 'grace', name: 'Grace Hopper', role: 'Editor' },
]

const components = {
  documentType: 'components',
  id: 'components',
  imports: { kit: 'components/kit.yaml' },
  components: {
    person_card: {
      root: { id: 'person_card', component: 'card', children: [
        { id: 'name', component: 'heading', props: { text: '{{props.name}}', level: 3 } },
        { id: 'role', component: 'text', props: { text: '{{props.role}}' } },
      ] },
    },
    team_section: {
      root: { id: 'team_section', component: 'section', children: [
        { id: 'team', component: 'grid', repeat: { cell: 'person_card', items: PEOPLE } },
      ] },
    },
    // Shares its name with the text element, which wins wherever `text` is a cell.
    text: { root: { id: 'text', component: 'stack', children: [{ id: 'phantom', component: 'text', props: { text: 'Phantom' } }] } },
  },
}

const kit = {
  documentType: 'components',
  id: 'kit',
  components: { text: { root: { id: 'text', component: 'text', props: { text: 'Kit {{props.label}}' } } } },
}

const templates = {
  documentType: 'templates',
  id: 'templates',
  templates: {
    main_template: {
      layout: { type: 'stack' },
      regions: [
        { id: 'fixed', kind: 'persistent', children: [
          { id: 'template_rows', component: 'stack', repeat: { cell: 'text', items: [{ id: 'ada', text: 'Template Ada' }, { id: 'grace', text: 'Template Grace' }] } },
          { id: 'holder', injectable: true },
          { id: 'bar', component: 'stack', children: [{ id: 'nested_holder', injectable: true }] },
        ] },
        { id: 'main', kind: 'slot' },
      ],
    },
  },
}

const page = {
  documentType: 'page',
  id: 'home',
  page: {
    id: 'home',
    template: 'main_template',
    viewport: { device: 'web' },
    slots: [{ slotId: 'main', content: [
      { id: 'team', component: 'grid', repeat: { cell: 'person_card', items: PEOPLE } },
      { id: 'core', use: 'team_section' },
      { id: 'other', use: 'team_section' },
      { id: 'labels', component: 'stack', repeat: { cell: 'text', items: [{ id: 'one', text: 'Element one' }] } },
      { id: 'kit_labels', component: 'stack', repeat: { cell: 'kit.text', items: [{ id: 'one', label: 'one' }] } },
      { id: 'plain_text', component: 'text', props: { text: 'Plain element' } },
    ] }],
    injectables: [{ injectableId: 'holder', content: [
      { id: 'injected', component: 'stack', repeat: { cell: 'text', items: [{ id: 'ada', text: 'Injected Ada' }, { id: 'grace', text: 'Injected Grace' }] } },
    ] }, { injectableId: 'nested_holder', content: [
      { id: 'nested', component: 'stack', repeat: { cell: 'text', items: [{ id: 'ada', text: 'Nested Ada' }] } },
    ] }],
  },
}

function files(pageDoc: Record<string, unknown> = page, componentDoc: Record<string, unknown> = components): Record<string, string> {
  return {
    'manifest.yaml': doc({ documentType: 'manifest', id: 'manifest', manifest: { projectId: 'rows', name: 'Rows', schemaVersion: '1.1' } }),
    'sitemap.yaml': doc({ documentType: 'sitemap', id: 'sitemap', routes: [{ id: 'home', path: '/', page: 'home', template: 'main_template' }] }),
    'templates.yaml': doc(templates),
    'components.yaml': doc(componentDoc),
    'components/kit.yaml': doc(kit),
    'pages/home.yaml': doc(pageDoc),
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
  const view = frame.contentDocument!
  view.open()
  view.write(frame.getAttribute('srcdoc')!)
  view.close()
  const window_ = frame.contentWindow as unknown as { HTMLElement: typeof HTMLElement }
  window_.HTMLElement.prototype.scrollIntoView = () => {}
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

const treeItems = (id: string) => within(screen.getByTestId('workspace-node-tree')).queryAllByTestId(`node-tree-item-${id}`)

function clickTreeItem(item: HTMLElement) {
  fireEvent.click(within(item).getAllByRole('button').at(-1)!)
}

/** Opens every collapsed tree item. */
function expandAll() {
  const tree = screen.getByTestId('workspace-node-tree')
  for (let toggle = within(tree).queryAllByRole('button', { name: 'Expand' }); toggle.length > 0; toggle = within(tree).queryAllByRole('button', { name: 'Expand' })) {
    toggle.forEach((button) => fireEvent.click(button))
  }
}

function expandTreeItem(item: HTMLElement) {
  const toggle = within(item).queryByRole('button', { name: 'Expand' })
  if (toggle) fireEvent.click(toggle)
}

/** The item an address names, found the way `wf node` finds it, in the document it is written in. */
function itemAt(yamlFiles: Record<string, string>, address: string) {
  const parsed = parseAddress(address)
  expect(parsed.ok).toBe(true)
  const roots = parsed.doctype === 'page'
    ? buildPageRoots(parse(yamlFiles['pages/home.yaml']), parsed.documentId)
    : parsed.doctype === 'template'
      ? buildTemplateRoots(parse(yamlFiles['templates.yaml']).templates[parsed.documentId], parsed.documentId)
      : buildComponentRootsFromMap(parse(yamlFiles['components.yaml']).components, parsed.documentId)
  const resolved = resolveAddressInRoots(roots.roots, parsed.pathSegments)
  expect(resolved.ok, `${address}: ${resolved.error}`).toBe(true)
  expect(resolved.targetType).toBe('repeat-item')
  return resolved
}

describe('Workspace rows in templates, injections and definitions', { timeout: 30000 }, () => {
  it('addresses template rows in the template and injected rows in their injection, listed once', async () => {
    const onNodeSelect = vi.fn()
    const yamlFiles = files()
    render(workspace(yamlFiles, onNodeSelect))
    const frame = await loadPreview('Injected Grace')

    expandAll()
    expect(treeItems('injected__ada')).toHaveLength(1)
    expect(treeItems('template_rows__ada')).toHaveLength(1)

    const templateRow = 'wf://template/main_template#fixed.template_rows.template_rows__ada'
    await clickRendered(frame, 'template_rows__ada')
    expect(onNodeSelect).toHaveBeenLastCalledWith(templateRow)
    expect(itemAt(yamlFiles, templateRow).item).toEqual({ id: 'ada', text: 'Template Ada' })
    clickTreeItem(treeItems('template_rows__grace')[0])
    expect(itemAt(yamlFiles, onNodeSelect.mock.lastCall![0]).item.text).toBe('Template Grace')

    expect(treeItems('nested__ada')).toHaveLength(1)
    await clickRendered(frame, 'nested__ada')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#nested_holder.nested.nested__ada')
    expect(itemAt(yamlFiles, 'wf://page/home#nested_holder.nested.nested__ada').item.text).toBe('Nested Ada')

    const injectedRow = 'wf://page/home#holder.injected.injected__ada'
    await clickRendered(frame, 'injected__ada')
    expect(onNodeSelect).toHaveBeenLastCalledWith(injectedRow)
    expect(itemAt(yamlFiles, injectedRow).item).toEqual({ id: 'ada', text: 'Injected Ada' })
    clickTreeItem(treeItems('injected__grace')[0])
    expect(itemAt(yamlFiles, onNodeSelect.mock.lastCall![0]).item.text).toBe('Injected Grace')
  })

  it('edits a template row through its address and the preview follows', async () => {
    const onNodeSelect = vi.fn()
    const yamlFiles = files()
    const { rerender } = render(workspace(yamlFiles, onNodeSelect))
    const frame = await loadPreview('Template Grace')
    await clickRendered(frame, 'template_rows__grace')
    const address = onNodeSelect.mock.lastCall![0] as string

    const templatesDoc = parse(yamlFiles['templates.yaml'])
    const parsed = parseAddress(address)
    const roots = buildTemplateRoots(templatesDoc.templates[parsed.documentId], parsed.documentId)
    const row = resolveAddressInRoots(roots.roots, parsed.pathSegments)
    Object.assign(row.item, { text: 'Template Grace B.' })
    row.item.id = 'grace'
    rerender(workspace({ ...yamlFiles, 'templates.yaml': stringify(templatesDoc) }, onNodeSelect))
    const refreshed = await loadPreview('Template Grace B.')
    await clickRendered(refreshed, 'template_rows__grace')
    expect(onNodeSelect).toHaveBeenLastCalledWith(address)
  })

  it('selects the row from a tree click on its descendant, in a page and in a definition', async () => {
    const onNodeSelect = vi.fn()
    render(workspace(files(), onNodeSelect))
    await loadPreview('core__team__grace')

    const pageRow = treeItems('team__grace')[0]
    expandTreeItem(pageRow)
    clickTreeItem(within(pageRow.parentElement!).getByTestId('node-tree-item-name'))
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.team.team__grace')

    const definitionRow = 'wf://component/team_section#team_section.team.team__grace'
    const hosts = treeItems('team')
    expect(hosts).toHaveLength(3)
    expandTreeItem(hosts[1])
    const rows = treeItems('team__grace')
    expect(rows).toHaveLength(2)
    expandTreeItem(rows[1])
    clickTreeItem(within(rows[1].parentElement!).getByTestId('node-tree-item-role'))
    expect(onNodeSelect).toHaveBeenLastCalledWith(definitionRow)
    itemAt(files(), definitionRow)
  })

  it('lists element cells without the children of a same-named local component', async () => {
    const onNodeSelect = vi.fn()
    render(workspace(files(), onNodeSelect))
    const frame = await loadPreview('Element one')

    expect(treeItems('phantom')).toHaveLength(0)
    const elementRow = treeItems('labels__one')
    expect(elementRow).toHaveLength(1)
    expect(within(elementRow[0]).queryByRole('button', { name: /Expand|Collapse/ })).toBeNull()
    expect(frame.contentDocument!.body.textContent).not.toContain('Phantom')

    // A qualified reference names the component; its definition is imported, so it lists no internals.
    const kitRow = treeItems('kit_labels__one')
    expect(kitRow).toHaveLength(1)
    expect(within(kitRow[0]).queryByRole('button', { name: /Expand|Collapse/ })).toBeNull()
    expect(frame.contentDocument!.body.textContent).toContain('Kit one')
    await clickRendered(frame, 'kit_labels__one')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.kit_labels.kit_labels__one')
    clickTreeItem(treeItems('labels__one')[0])
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.labels.labels__one')

    // An authored element with the same name is an element too.
    expect(treeItems('plain_text')).toHaveLength(1)
    expect(within(treeItems('plain_text')[0]).queryByRole('button', { name: /Expand|Collapse/ })).toBeNull()
  })
})
