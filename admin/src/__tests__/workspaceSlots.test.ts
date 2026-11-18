import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { stringify } from 'yaml'
import { useResolvedNodes, buildNodeIdToAddressMap } from '../features/workspace/useWorkspaceData'
import type { ResolvedNode } from '../features/workspace/types'

const components = {
  documentType: 'components',
  specVersion: '1.1',
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
    checkout: {
      root: {
        id: 'checkout',
        component: 'stack',
        children: [{
          id: 'pay_panel',
          use: 'panel',
          children: [{ id: 'checkout_body', slot: 'default' }],
          slots: { footer: [{ id: 'pay', component: 'button' }, { id: 'checkout_actions', slot: 'actions' }] },
        }],
      },
    },
    legacy: {
      root: { id: 'legacy', component: 'section', children: [{ id: 'legacy_title', component: 'heading' }] },
    },
  },
}

const templates = {
  documentType: 'templates',
  specVersion: '1.1',
  id: 'templates',
  templates: { main_template: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } },
}

function filesWith(content: unknown[]) {
  return {
    'components.yaml': stringify(components),
    'templates.yaml': stringify(templates),
    'pages/home.yaml': stringify({
      documentType: 'page',
      specVersion: '1.1',
      id: 'home',
      page: { id: 'home', template: 'main_template', slots: [{ slotId: 'main', content }] },
    }),
  }
}

function find(nodes: ResolvedNode[], id: string): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = find(node.children, id)
    if (found) return found
  }
  return undefined
}

function resolve(content: unknown[]) {
  const { result } = renderHook(() => useResolvedNodes(filesWith(content), 'home'))
  return result.current
}

describe('useResolvedNodes with component slots', () => {
  const billing = [{
    id: 'billing_panel',
    use: 'panel',
    children: [{ id: 'plan_name', component: 'heading' }],
    slots: { footer: [{ id: 'upgrade', component: 'button' }] },
  }]

  it('puts page fills in the tree at their page-document address', () => {
    const nodes = resolve(billing)
    const panel = find(nodes, 'billing_panel')!
    expect(panel.address).toBe('wf://page/home#main.billing_panel')
    expect(panel.children.map((child) => child.id)).toEqual(['plan_name', 'upgrade'])
    expect(find(nodes, 'plan_name')!.address).toBe('wf://page/home#main.billing_panel.plan_name')
    expect(find(nodes, 'upgrade')!.address).toBe('wf://page/home#main.billing_panel.upgrade')
    expect(find(nodes, 'close')).toBeUndefined()
  })

  it('maps page fills to their own address and internals to the instance', () => {
    const map = buildNodeIdToAddressMap(resolve([...billing, { id: 'plain_panel', use: 'panel' }]))
    expect(map.get('upgrade')).toBe('wf://page/home#main.billing_panel.upgrade')
    expect(map.get('plan_name')).toBe('wf://page/home#main.billing_panel.plan_name')
    expect(map.get('plain_panel__close')).toBe('wf://page/home#main.plain_panel')
    expect(map.get('billing_panel')).toBe('wf://page/home#main.billing_panel')
  })

  it('keeps forwarded page content addressed on the page instance', () => {
    const nodes = resolve([{
      id: 'order',
      use: 'checkout',
      children: [{ id: 'summary', component: 'text' }],
      slots: { actions: [{ id: 'save', component: 'button' }] },
    }])
    const payPanel = find(nodes, 'pay_panel')!
    expect(payPanel.children.map((child) => child.id)).toEqual(['summary', 'pay', 'save'])
    expect(find(nodes, 'summary')!.address).toBe('wf://page/home#main.order.summary')
    expect(find(nodes, 'save')!.address).toBe('wf://page/home#main.order.save')

    const map = buildNodeIdToAddressMap(nodes)
    expect(map.get('summary')).toBe('wf://page/home#main.order.summary')
    expect(map.get('order__pay_panel')).toBe('wf://page/home#main.order')
    // A fill the component writes selects the instance too.
    expect(map.get('order__pay')).toBe('wf://page/home#main.order')
  })

  it('selects a nested page-authored instance, not its outer one', () => {
    const map = buildNodeIdToAddressMap(resolve([{
      id: 'outer',
      use: 'panel',
      children: [{ id: 'inner', use: 'panel' }],
    }]))
    expect(map.get('inner')).toBe('wf://page/home#main.outer.inner')
    expect(map.get('inner__close')).toBe('wf://page/home#main.outer.inner')
    expect(map.get('outer__close')).toBe('wf://page/home#main.outer')
  })

  it('leaves components without slots as they were', () => {
    const nodes = resolve([{ id: 'old', use: 'legacy' }])
    const old = find(nodes, 'old')!
    expect(old.children.map((child) => child.id)).toEqual(['legacy_title'])
    expect(buildNodeIdToAddressMap(nodes).get('old__legacy_title')).toBe('wf://page/home#main.old')
  })
})
