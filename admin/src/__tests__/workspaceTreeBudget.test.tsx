import { describe, it, expect, vi } from 'vitest'
import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { stringify } from 'yaml'
import '../i18n'
import type { ResolvedNode } from '../features/workspace/types'

// The real renderer renders these pages: nothing here stubs the preview.
const { Workspace } = await import('../features/workspace/Workspace')
const { useWorkspaceTree } = await import('../features/workspace/useWorkspaceData')
const { loadRenderer } = await import('../features/workspace/rendererModule')
const renderer = (await loadRenderer())!

const doc = (value: Record<string, unknown>) => stringify({ specVersion: '1.1', ...value })
const items = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `i${index}` }))

/** `outer` rows of a wall, each wall `inner` rows of a pair, each pair a stack and one text. */
function fanOut(outer: number, inner: number): Record<string, string> {
  return files(
    { pair: { root: { id: 'pair', component: 'stack', children: [{ id: 'leaf', component: 'text', props: { text: 'x' } }] } },
      wall: { root: { id: 'wall', component: 'stack', repeat: { cell: 'pair', items: items(inner) } } } },
    [{ id: 'walls', component: 'stack', repeat: { cell: 'wall', items: items(outer) } }],
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
    render(
      <Workspace
        yamlFiles={yamlFiles}
        activePage="home"
        onPageChange={vi.fn()}
        device="web"
        onDeviceChange={vi.fn()}
        renderMode="card"
        onRenderModeChange={vi.fn()}
        showTree
      />,
    )
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
