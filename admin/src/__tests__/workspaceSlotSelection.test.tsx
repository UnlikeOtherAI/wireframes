import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { stringify } from 'yaml'
import '../i18n'

vi.mock('@wireframes/renderer', () => ({
  renderPage: vi.fn(() => '<html><body></body></html>'),
}))

const { Workspace } = await import('../features/workspace/Workspace')

const yamlFiles: Record<string, string> = {
  'components.yaml': stringify({
    documentType: 'components',
    id: 'components',
    components: {
      panel: {
        root: {
          id: 'panel',
          component: 'card',
          children: [
            { id: 'body', slot: 'default' },
            { id: 'footer', slot: 'footer', children: [{ id: 'close', component: 'button' }] },
          ],
        },
      },
    },
  }),
  'templates.yaml': stringify({
    documentType: 'templates',
    id: 'templates',
    templates: { main: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } },
  }),
  'pages/home.yaml': stringify({
    documentType: 'page',
    id: 'home',
    page: {
      template: 'main',
      slots: [{
        slotId: 'main',
        content: [
          {
            id: 'billing_panel',
            use: 'panel',
            children: [{ id: 'plan_name', component: 'heading' }],
            slots: { footer: [{ id: 'upgrade', component: 'button' }] },
          },
          { id: 'plain_panel', use: 'panel' },
        ],
      }],
    },
  }),
}

function renderWorkspace(onNodeSelect: (address: string) => void) {
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

function clickInPreview(nodeId: string) {
  const iframe = screen.getByTestId('workspace-preview-iframe') as HTMLIFrameElement
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow,
      data: { type: 'wf:nodeClick', nodeId, address: `wf://page/home#${nodeId}` },
    }))
  })
}

describe('Workspace selection with component slots', () => {
  it('selects a clicked page fill at its page-document address', () => {
    const onNodeSelect = vi.fn()
    renderWorkspace(onNodeSelect)
    clickInPreview('upgrade')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.billing_panel.upgrade')
    clickInPreview('plan_name')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.billing_panel.plan_name')
  })

  it('selects the page-authored instance when component content is clicked', () => {
    const onNodeSelect = vi.fn()
    renderWorkspace(onNodeSelect)
    clickInPreview('plain_panel__close')
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.plain_panel')
  })

  it('lists the page fill in the tree and selects it there too', () => {
    const onNodeSelect = vi.fn()
    renderWorkspace(onNodeSelect)
    const item = screen.getByTestId('node-tree-item-upgrade')
    fireEvent.click(item.querySelector('button, [role="button"]') ?? item)
    expect(onNodeSelect).toHaveBeenLastCalledWith('wf://page/home#main.billing_panel.upgrade')
  })
})
