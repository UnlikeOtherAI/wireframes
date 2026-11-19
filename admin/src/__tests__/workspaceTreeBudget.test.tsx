import { describe, it, expect, vi } from 'vitest'
import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { stringify } from 'yaml'
import '../i18n'
import type { ResolvedNode } from '../features/workspace/types'
import { clickRendered, loadPreview, treeItems } from './previewFrame'

// The real renderer renders these pages: nothing here stubs the preview.
const { Workspace } = await import('../features/workspace/Workspace')
const { useWorkspaceTree } = await import('../features/workspace/useWorkspaceData')
const { loadRenderer } = await import('../features/workspace/rendererModule')
const renderer = (await loadRenderer())!

const doc = (value: Record<string, unknown>) => stringify({ specVersion: '1.1', ...value })
const items = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `i${index}` }))

/** A wall of `inner` pairs, each pair a stack and one text. */
const wallOf = (inner: number) => ({
  pair: { root: { id: 'pair', component: 'stack', children: [{ id: 'leaf', component: 'text', props: { text: 'x' } }] } },
  wall: { root: { id: 'wall', component: 'stack', repeat: { cell: 'pair', items: items(inner) } } },
})
const walls = wallOf(130)

/** `outer` rows of a wall of `inner` pairs. */
function fanOut(outer: number, inner: number): Record<string, string> {
  return files(wallOf(inner), [{ id: 'walls', component: 'stack', repeat: { cell: 'wall', items: items(outer) } }])
}

function workspace(yamlFiles: Record<string, string>, onNodeSelect?: (address: string) => void) {
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

function files(components: Record<string, unknown>, content: unknown[]): Record<string, string> {
  return {
    'manifest.yaml': doc({ documentType: 'manifest', id: 'manifest', manifest: { projectId: 'big', name: 'Big', schemaVersion: '1.1' } }),
    'sitemap.yaml': doc({ documentType: 'sitemap', id: 'sitemap', routes: [{ id: 'home', path: '/', page: 'home', template: 'main_template' }] }),
    'templates.yaml': doc({ documentType: 'templates', id: 'templates',
      templates: { main_template: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } } }),
    'components.yaml': doc({ documentType: 'components', id: 'components', components }),
    'pages/home.yaml': doc({ documentType: 'page', id: 'home', page: { id: 'home', template: 'main_template', viewport: { device: 'web' }, slots: [{ slotId: 'main', content }] } }),
  }
}

const count = (nodes: ResolvedNode[]): number => nodes.reduce((sum, node) => sum + 1 + count(node.children), 0)
const tree = (yamlFiles: Record<string, string>) => renderHook(() => useWorkspaceTree(yamlFiles, 'home')).result.current
/** Why the preview refuses to render the page, or null when it renders. */
const refusal = (yamlFiles: Record<string, string>) => {
  try {
    renderer.renderPage(yamlFiles, 'home')
    return null
  } catch (error) {
    return String(error)
  }
}

describe('Workspace tree expansion budget', { timeout: 60000 }, () => {
  it('says why it lists nothing for a fan-out past the budget, as the preview refuses it', async () => {
    // 200 walls of 130 pairs would list 52,202 nodes.
    const yamlFiles = fanOut(200, 130)
    render(workspace(yamlFiles))
    const panel = screen.getByTestId('workspace-node-tree')
    expect(panel).toHaveAttribute('role', 'status')
    expect(panel.textContent).toBe(
      'The repeat on "walls" would take this page past 50,000 nodes, so the tree cannot list it. Give it fewer items, or use a smaller cell.',
    )
    expect(within(panel).queryAllByRole('treeitem')).toHaveLength(0)
    const frame = screen.getByTestId('workspace-preview-iframe') as HTMLIFrameElement
    await waitFor(() => expect(frame.getAttribute('srcdoc') ?? '').toContain('Repeat on "walls" would expand'), { timeout: 30000 })
  })

  it('refuses at the outer repeat by the engine count, before listing a row', () => {
    // The tree would list 44,372 nodes, but the engine counts each row's cell
    // root as well, 66,640, so the resolver refuses the page and so does the tree.
    const yamlFiles = fanOut(170, 130)
    expect(tree(yamlFiles)).toEqual({ nodes: [], notice: { kind: 'too-large', max: 50000, host: 'walls' } })
    expect(refusal(yamlFiles)).toContain('Repeat on "walls" would expand to 66640 more nodes')
  })

  it('lists a page the engine expands within the budget', () => {
    // 150 walls of 100 pairs: the engine counts 45,300 and renders it.
    const yamlFiles = fanOut(150, 100)
    const { nodes, notice } = tree(yamlFiles)
    expect(notice).toBeNull()
    expect(count(nodes)).toBe(1 + 1 + 150 * (1 + 100 * 2))
    expect(refusal(yamlFiles)).toBeNull()
  })

  it('charges a slotless instance for the children that replace its root, not for the rows they discard', async () => {
    // `own` repeats 200 walls of 130 pairs, which no page expands to; the instance's children replace them.
    const components = {
      ...walls,
      own: { root: { id: 'own', component: 'stack', repeat: { cell: 'wall', items: items(200) } } },
    }
    const kept = { id: 'kept', component: 'text', props: { text: 'Override stays' } }
    const yamlFiles = files(components, [{ id: 'replaced', use: 'own', children: [kept] }])
    expect(refusal(yamlFiles)).toBeNull()

    const { nodes, notice } = tree(yamlFiles)
    expect(notice).toBeNull()
    const [instance] = nodes[0].children
    expect(instance.children.map(({ id, renderedId, address }) => ({ id, renderedId, address }))).toEqual([
      { id: 'kept', renderedId: 'replaced__kept', address: 'wf://page/home#main.replaced.kept' },
    ])

    // Mounted, the tree lists the override, and a click on it in the preview selects it.
    const onNodeSelect = vi.fn()
    render(workspace(yamlFiles, onNodeSelect))
    const frame = await loadPreview('Override stays')
    expect(treeItems('kept')).toHaveLength(1)
    expect(frame.contentDocument!.querySelector('[id^="replaced__own__"]')).toBeNull()
    await clickRendered(frame, 'replaced__kept')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.replaced.kept')

    // Without the override the root's rows render, and the tree refuses them where the preview does.
    const unchanged = files(components, [{ id: 'replaced', use: 'own' }])
    expect(tree(unchanged)).toEqual({ nodes: [], notice: { kind: 'too-large', max: 50000, host: 'own' } })
    expect(refusal(unchanged)).toContain('Repeat on "own" would expand')
  })

  it('charges the rows of a slotless override with its instance, as the resolver does', () => {
    const big = { id: 'big', component: 'stack', repeat: { cell: 'wall', items: items(200) } }
    const own = { root: { id: 'own', component: 'stack', children: [{ id: 'small', component: 'text', props: { text: 'x' } }] } }
    const yamlFiles = files({ ...walls, own }, [{ id: 'replaced', use: 'own', children: [big] }])
    expect(refusal(yamlFiles)).toContain('Repeat on "big" would expand')
    expect(tree(yamlFiles)).toEqual({ nodes: [], notice: { kind: 'too-large', max: 50000, host: 'big' } })
  })

  it('reserves the fan-out of sibling hosts in one definition together, as the resolver does', () => {
    // Each host fits on its own (100 walls of 130 pairs, 39,200 nodes); together they do not.
    const host = (id: string) => ({ id, component: 'stack', repeat: { cell: 'wall', items: items(100) } })
    const pair = { root: { id: 'pair_walls', component: 'stack', children: [host('wall_a'), host('wall_b')] } }
    const yamlFiles = files({ ...walls, pair_walls: pair }, [{ id: 'both', use: 'pair_walls' }])
    expect(refusal(yamlFiles)).toContain('Repeat on "wall_b" would expand')
    expect(tree(yamlFiles)).toEqual({ nodes: [], notice: { kind: 'too-large', max: 50000, host: 'wall_b' } })
  })

  it('stops at the budget when nested instances pass it without a repeat', () => {
    const level = (id: string, next: string) => ({ root: { id, component: 'stack', children: items(10).map(({ id: child }) => ({ id: child, use: next })) } })
    const yamlFiles = files({
      d0: level('d0', 'd1'), d1: level('d1', 'd2'), d2: level('d2', 'd3'), d3: level('d3', 'd4'),
      d4: level('d4', 'leaf'), leaf: { root: { id: 'leaf', component: 'text', props: { text: 'x' } } },
    }, [{ id: 'top', use: 'd0' }])
    expect(tree(yamlFiles)).toEqual({ nodes: [], notice: { kind: 'too-large', max: 50000, host: null } })
    expect(refusal(yamlFiles)).toContain('Expanded wireframe is too large')
  })
})
