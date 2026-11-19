import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { stringify } from 'yaml'
import '../i18n'
import { clickRendered, clickTreeItem, expandAll, loadPreview, nodeAt, outline, treeChildren, treeItems } from './previewFrame'

// The real renderer renders these pages: nothing here stubs the preview.
const { Workspace } = await import('../features/workspace/Workspace')

const doc = (value: Record<string, unknown>) => stringify({ specVersion: '1.1', ...value })
const marker = { id: 'holder', injectable: true }
const injected = { id: 'injected', component: 'stack', repeat: { cell: 'text', items: [
  { id: 'ada', text: 'Injection Ada' }, { id: 'grace', text: 'Injection Grace' },
] } }

/** A page whose `fixed` region holds `fixed`, with `main` filled and `holder` injected. */
function files(fixed: unknown, fallback: unknown[], injection: unknown[]): Record<string, string> {
  return {
    'manifest.yaml': doc({ documentType: 'manifest', id: 'manifest', manifest: { projectId: 'hooks', name: 'Hooks', schemaVersion: '1.1' } }),
    'sitemap.yaml': doc({ documentType: 'sitemap', id: 'sitemap', routes: [{ id: 'home', path: '/', page: 'home', template: 'main_template' }] }),
    'templates.yaml': doc({ documentType: 'templates', id: 'templates', templates: { main_template: {
      layout: { type: 'stack' },
      regions: [{ id: 'fixed', kind: 'persistent', children: [fixed] }, { id: 'main', kind: 'slot', children: fallback }],
    } } }),
    // A component that expands to a marker: its instance takes the injection named by its id.
    'components.yaml': doc({ documentType: 'components', id: 'components', components: { hook_def: { root: { id: 'hook_root', injectable: true } } } }),
    'pages/home.yaml': doc({ documentType: 'page', id: 'home', page: {
      id: 'home', template: 'main_template', viewport: { device: 'web' },
      slots: [{ slotId: 'main', content: [{ id: 'main_text', component: 'text', props: { text: 'Main text' } }] }],
      injectables: [{ injectableId: 'holder', content: injection }],
    } }),
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

describe('Workspace injection markers', { timeout: 30000 }, () => {
  it('lists what a component-produced marker injects once, and selects it where the page writes it', async () => {
    const onNodeSelect = vi.fn()
    // The instance `holder` expands to a marker; the template's own marker is in a fallback the page replaces.
    const yamlFiles = files({ id: 'holder', use: 'hook_def' }, [marker], [injected])
    render(workspace(yamlFiles, onNodeSelect))
    const frame = await loadPreview('Injection Grace')
    expect(frame.contentDocument!.querySelectorAll('#injected__ada')).toHaveLength(1)

    expandAll()
    const holder = treeItems('holder')
    expect(holder).toHaveLength(1)
    expect(treeChildren(holder[0])).toEqual(['injected'])
    expect(treeItems('injected__ada')).toHaveLength(1)

    const row = 'wf://page/home#holder.injected.injected__ada'
    await clickRendered(frame, 'injected__ada')
    expect(onNodeSelect).toHaveBeenLastCalledWith(row)
    expect(nodeAt(yamlFiles, row).item).toEqual({ id: 'ada', text: 'Injection Ada' })
    await waitFor(() => expect(outline(frame, 'injected__ada')).not.toBe(''))

    clickTreeItem(treeItems('injected__grace')[0])
    expect(nodeAt(yamlFiles, onNodeSelect.mock.lastCall![0]).item).toEqual({ id: 'grace', text: 'Injection Grace' })
    await waitFor(() => expect(outline(frame, 'injected__grace')).not.toBe(''))
  })

  it('lists nothing at a marker its own injection reaches again, and everything else', async () => {
    const onNodeSelect = vi.fn()
    const yamlFiles = files(marker, [], [marker, injected])
    render(workspace(yamlFiles, onNodeSelect))
    const frame = await loadPreview('Injection Grace')
    expect(frame.contentDocument!.querySelectorAll('#injected__ada')).toHaveLength(1)

    expect(screen.getByTestId('workspace-node-tree')).toHaveAttribute('role', 'tree')
    expandAll()
    expect(treeItems('main_text')).toHaveLength(1)
    // The outer marker lists the injection; the marker inside it renders nothing, so it lists nothing.
    const [outer, inner] = treeItems('holder')
    expect(treeItems('holder')).toHaveLength(2)
    expect(treeChildren(outer)).toEqual(['holder', 'injected'])
    expect(treeChildren(inner)).toEqual([])
    expect(treeItems('injected__ada')).toHaveLength(1)

    // The inner marker is written in the injection, which is where it is removed.
    clickTreeItem(inner)
    expect(nodeAt(yamlFiles, onNodeSelect.mock.lastCall![0]).node).toEqual(marker)

    const row = 'wf://page/home#holder.injected.injected__ada'
    await clickRendered(frame, 'injected__ada')
    expect(onNodeSelect).toHaveBeenLastCalledWith(row)
    expect(nodeAt(yamlFiles, row).item).toEqual({ id: 'ada', text: 'Injection Ada' })
  })
})
