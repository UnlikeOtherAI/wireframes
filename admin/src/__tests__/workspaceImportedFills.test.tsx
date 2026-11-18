import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { parse, stringify } from 'yaml'
import '../i18n'
// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
import * as addressing from '../../../engine/addressing/index.js'

// The real renderer renders these pages: nothing here stubs the preview.
const { Workspace } = await import('../features/workspace/Workspace')
const { WorkspacePreview } = await import('../features/workspace/WorkspacePreview')

const { parseAddress, buildPageRoots, resolveAddressInRoots } = addressing as {
  parseAddress: (address: string) => { ok: boolean; pathSegments: string[] }
  buildPageRoots: (pageDoc: unknown, pageId: string) => { ok: boolean; roots: unknown[] }
  resolveAddressInRoots: (roots: unknown[], segments: string[]) => { ok: boolean; node: Record<string, unknown>; error?: string }
}

const kit = {
  documentType: 'components',
  specVersion: '1.1',
  id: 'kit',
  components: {
    panel: {
      root: {
        id: 'panel',
        component: 'card',
        children: [
          { id: 'panel_title', component: 'heading', props: { text: 'Kit panel' } },
          { id: 'body', slot: 'default' },
          { id: 'footer', slot: 'footer' },
        ],
      },
    },
  },
}

function pageWith(heroMedia: string) {
  return {
    documentType: 'page',
    specVersion: '1.1',
    id: 'home',
    page: {
      id: 'home',
      template: 'main_template',
      viewport: { device: 'web' },
      slots: [{
        slotId: 'main',
        content: [
          { id: 'hero', use: 'std.hero', slots: { media: [{ id: 'custom_media', component: 'text', props: { text: heroMedia } }] } },
          { id: 'kit_panel', use: 'kit.panel', slots: { footer: [{ id: 'custom_footer', component: 'button', props: { label: 'Kit footer' } }] } },
        ],
      }],
      overlays: [{
        id: 'help_modal',
        type: 'modal',
        content: [{ id: 'modal_panel', use: 'kit.panel', children: [{ id: 'modal_fill', component: 'text', props: { text: 'In a modal' } }] }],
      }],
    },
  }
}

function filesWith(heroMedia: string): Record<string, string> {
  return {
    'manifest.yaml': stringify({
      documentType: 'manifest', specVersion: '1.1', id: 'manifest',
      manifest: { projectId: 'fills', name: 'Fills', schemaVersion: '1.1' },
    }),
    'sitemap.yaml': stringify({
      documentType: 'sitemap', specVersion: '1.1', id: 'sitemap',
      routes: [{ id: 'home', path: '/', page: 'home', template: 'main_template' }],
    }),
    'templates.yaml': stringify({
      documentType: 'templates', specVersion: '1.1', id: 'templates',
      templates: { main_template: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } },
    }),
    'components.yaml': stringify({
      documentType: 'components', specVersion: '1.1', id: 'components', components: {}, imports: { kit: 'components/kit.yaml' },
    }),
    'components/kit.yaml': stringify(kit),
    'pages/home.yaml': stringify(pageWith(heroMedia)),
  }
}

function mountWorkspace(yamlFiles: Record<string, string>, onNodeSelect: (address: string) => void) {
  return render(
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
    />,
  )
}

function previewFrame() {
  return screen.getByTestId('workspace-preview-iframe') as HTMLIFrameElement
}

/** Waits for the rendered page, then loads it into the frame as a browser loads `srcdoc`. */
async function loadPreview(expected: string) {
  const frame = previewFrame()
  await waitFor(() => expect(frame.getAttribute('srcdoc') ?? '').toContain(expected), { timeout: 15000 })
  const doc = frame.contentDocument!
  doc.open()
  doc.write(frame.getAttribute('srcdoc')!)
  doc.close()
  // The selection highlight scrolls the node into view, which jsdom does not lay out.
  const view = frame.contentWindow as unknown as { HTMLElement: typeof HTMLElement }
  view.HTMLElement.prototype.scrollIntoView = () => {}
  return frame
}

/**
 * Clicks a rendered node and delivers what the page's own click bridge posts.
 * jsdom drops the message's origin and source, so they are set as a browser sets
 * them for a same-origin srcdoc frame.
 */
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
  // jsdom keeps a document's listeners across document.open, so a page loaded twice
  // into one frame posts once per load; a browser loads a fresh document instead.
  expect(new Set(posted.map((data) => JSON.stringify(data))).size).toBe(1)
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: posted[0] }))
  })
}

function selectInTree(id: string) {
  const item = screen.getByTestId(`node-tree-item-${id}`)
  fireEvent.click(within(item).getAllByRole('button').at(-1)!)
}

/** The page node an address names, found the way `wf node` finds it. */
function pageNodeAt(pageYaml: Record<string, unknown>, address: string) {
  const parsed = parseAddress(address)
  const roots = buildPageRoots(pageYaml, 'home')
  const resolved = resolveAddressInRoots(roots.roots, parsed.pathSegments)
  expect(resolved.ok, resolved.error).toBe(true)
  return resolved.node
}

// The first render loads the whole engine.
describe('Workspace selection of fills on imported and built-in components', { timeout: 20000 }, () => {
  it('lists page fills of std and imported instances in the tree, addressed in the page', async () => {
    const onNodeSelect = vi.fn()
    mountWorkspace(filesWith('Hero media'), onNodeSelect)
    await loadPreview('custom_media')

    selectInTree('custom_media')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.hero.custom_media')
    selectInTree('custom_footer')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.kit_panel.custom_footer')
    selectInTree('modal_fill')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#help_modal.modal_panel.modal_fill')
  })

  it('selects a clicked fill at its page address and an internal node at its instance', async () => {
    const onNodeSelect = vi.fn()
    mountWorkspace(filesWith('Hero media'), onNodeSelect)
    const frame = await loadPreview('custom_media')

    await clickRendered(frame, 'custom_media')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.hero.custom_media')
    await clickRendered(frame, 'custom_footer')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.kit_panel.custom_footer')
    await clickRendered(frame, 'hero__title')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.hero')
    await clickRendered(frame, 'kit_panel__panel_title')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.kit_panel')
    await clickRendered(frame, 'modal_fill')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#help_modal.modal_panel.modal_fill')
  })

  it('edits a selected fill in the page document and the preview follows', async () => {
    const onNodeSelect = vi.fn()
    const files = filesWith('Hero media')
    const { rerender } = mountWorkspace(files, onNodeSelect)
    const frame = await loadPreview('Hero media')
    await clickRendered(frame, 'custom_media')
    const address = onNodeSelect.mock.lastCall![0] as string

    const pageYaml = parse(files['pages/home.yaml']) as Record<string, unknown>
    const node = pageNodeAt(pageYaml, address)
    expect(node.id).toBe('custom_media')
    node.props = { text: 'Edited media' }
    const edited = { ...files, 'pages/home.yaml': stringify(pageYaml) }

    rerender(
      <Workspace
        yamlFiles={edited}
        activePage="home"
        onPageChange={vi.fn()}
        device="web"
        onDeviceChange={vi.fn()}
        renderMode="card"
        onRenderModeChange={vi.fn()}
        showTree
        onNodeSelect={onNodeSelect}
      />,
    )
    const refreshed = await loadPreview('Edited media')
    await clickRendered(refreshed, 'custom_media')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.hero.custom_media')
    expect(pageNodeAt(parse(edited['pages/home.yaml']) as Record<string, unknown>, 'wf://page/home#main.kit_panel.custom_footer').id)
      .toBe('custom_footer')
  })
})

describe('Preview messages are trusted only from the preview itself', () => {
  it('ignores a click or navigation from the frame with another origin', async () => {
    const onNodeSelect = vi.fn()
    const onNavigate = vi.fn()
    render(<WorkspacePreview yamlFiles={{}} activePage="home" device="web" renderMode="card" onNodeSelect={onNodeSelect} onNavigate={onNavigate} />)
    const frame = previewFrame()
    act(() => {
      for (const data of [{ type: 'wf:nodeClick', nodeId: 'home' }, { type: 'wf:navigate', routeId: 'about' }]) {
        window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: 'https://elsewhere.example', data }))
      }
    })
    expect(onNodeSelect).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('never takes an address from the message, and selects only known or well-formed nodes', () => {
    const onNodeSelect = vi.fn()
    const send = (frame: HTMLIFrameElement, data: unknown) => act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data }))
    })
    const { unmount } = render(<WorkspacePreview yamlFiles={{}} activePage="home" device="web" renderMode="card" onNodeSelect={onNodeSelect} />)
    send(previewFrame(), { type: 'wf:nodeClick', nodeId: 'title', address: 'wf://component/std.login#login' })
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#title')
    send(previewFrame(), { type: 'wf:nodeClick', nodeId: 'Bad id', address: 'wf://page/home#main.title' })
    send(previewFrame(), { type: 'wf:nodeClick', address: 'wf://page/home#main.title' })
    expect(onNodeSelect).toHaveBeenCalledTimes(1)
    unmount()

    // With a node map, an id the tree does not know selects nothing.
    const map = new Map([['card', 'wf://page/home#main.card']])
    render(<WorkspacePreview yamlFiles={{}} activePage="home" device="web" renderMode="card" onNodeSelect={onNodeSelect} nodeIdToAddress={map} />)
    send(previewFrame(), { type: 'wf:nodeClick', nodeId: 'card__inner', ancestorIds: ['card'] })
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.card')
    send(previewFrame(), { type: 'wf:nodeClick', nodeId: 'stray', ancestorIds: ['other'] })
    expect(onNodeSelect).toHaveBeenCalledTimes(2)
  })
})
