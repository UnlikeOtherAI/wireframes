import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import '../i18n'

// Mock the renderer module
vi.mock('@wireframes/renderer', () => ({
  renderPage: vi.fn((_files: Record<string, string>, pageId: string) => {
    return `<html><body><div>Rendered: ${pageId}</div></body></html>`
  }),
  renderProject: vi.fn(() => ({
    pages: new Map([['home', '<html><body>Home</body></html>']]),
    css: '',
    js: '',
    routeTable: {},
  })),
  parseProject: vi.fn((_files: Record<string, string>) => ({
    documentMap: {},
    pageIds: ['home', 'about'],
    routeIds: ['home', 'about'],
  })),
}))

const { Workspace } = await import('../features/workspace/Workspace')
const { PageNavigation } = await import('../features/workspace/PageNavigation')
const { DeviceControls } = await import('../features/workspace/DeviceControls')
const { NodeTree } = await import('../features/workspace/NodeTree')
const { SitemapView } = await import('../features/workspace/SitemapView')
import type { WorkspaceRef } from '../features/workspace/Workspace'
import type { ResolvedNode, SitemapNode } from '../features/workspace/types'

const sampleYamlFiles: Record<string, string> = {
  'manifest.yaml': 'documentType: manifest\nname: Test\n',
  'sitemap.yaml': 'documentType: sitemap\nroutes:\n  - id: home\n    page: home\n    path: /\n  - id: about\n    page: about\n    path: /about\n',
  'pages/home.yaml': 'documentType: page\nid: home\npage:\n  template: main\n  body:\n    - id: header\n      type: section\n      children:\n        - id: title\n          type: heading\n',
  'pages/about.yaml': 'documentType: page\nid: about\npage:\n  template: main\n  body:\n    - id: content\n      type: section\n',
}

describe('Workspace', () => {
  let onPageChange: ReturnType<typeof vi.fn>
  let onDeviceChange: ReturnType<typeof vi.fn>
  let onRenderModeChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onPageChange = vi.fn()
    onDeviceChange = vi.fn()
    onRenderModeChange = vi.fn()
  })

  function renderWorkspace(overrides: Partial<React.ComponentProps<typeof Workspace>> = {}) {
    return render(
      <Workspace
        yamlFiles={sampleYamlFiles}
        activePage="home"
        onPageChange={onPageChange}
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
        {...overrides}
      />,
    )
  }

  it('renders the workspace container', () => {
    renderWorkspace()
    expect(screen.getByTestId('workspace')).toBeInTheDocument()
  })

  it('renders device controls when showDeviceControls is true', () => {
    renderWorkspace({ showDeviceControls: true })
    expect(screen.getByTestId('workspace-device-controls')).toBeInTheDocument()
  })

  it('hides device controls when showDeviceControls is false', () => {
    renderWorkspace({ showDeviceControls: false })
    expect(screen.queryByTestId('workspace-device-controls')).not.toBeInTheDocument()
  })

  it('renders page navigation when showNavigation is true', () => {
    renderWorkspace({ showNavigation: true })
    expect(screen.getByTestId('workspace-page-navigation')).toBeInTheDocument()
  })

  it('hides page navigation when showNavigation is false', () => {
    renderWorkspace({ showNavigation: false })
    expect(screen.queryByTestId('workspace-page-navigation')).not.toBeInTheDocument()
  })

  it('renders the preview iframe', () => {
    renderWorkspace()
    expect(screen.getByTestId('workspace-preview-iframe')).toBeInTheDocument()
  })

  it('shows tree/sitemap panel when showTree is true', () => {
    renderWorkspace({ showTree: true })
    expect(screen.getByTestId('workspace-right-panel')).toBeInTheDocument()
    expect(screen.getByTestId('tab-tree')).toBeInTheDocument()
    expect(screen.getByTestId('tab-sitemap')).toBeInTheDocument()
  })

  it('hides tree panel when showTree is false', () => {
    renderWorkspace({ showTree: false })
    expect(screen.queryByTestId('workspace-right-panel')).not.toBeInTheDocument()
  })

  it('exposes imperative ref methods', () => {
    const ref = React.createRef<WorkspaceRef>()
    render(
      <Workspace
        ref={ref}
        yamlFiles={sampleYamlFiles}
        activePage="home"
        onPageChange={onPageChange}
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
      />,
    )

    expect(ref.current).not.toBeNull()
    expect(typeof ref.current!.navigateTo).toBe('function')
    expect(typeof ref.current!.setDevice).toBe('function')
    expect(typeof ref.current!.setMode).toBe('function')
    expect(typeof ref.current!.highlightNode).toBe('function')
    expect(typeof ref.current!.getRenderedHtml).toBe('function')
    expect(typeof ref.current!.refresh).toBe('function')
  })

  it('navigateTo calls onPageChange', () => {
    const ref = React.createRef<WorkspaceRef>()
    render(
      <Workspace
        ref={ref}
        yamlFiles={sampleYamlFiles}
        activePage="home"
        onPageChange={onPageChange}
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
      />,
    )

    ref.current!.navigateTo('about')
    expect(onPageChange).toHaveBeenCalledWith('about')
  })

  it('setDevice calls onDeviceChange', () => {
    const ref = React.createRef<WorkspaceRef>()
    render(
      <Workspace
        ref={ref}
        yamlFiles={sampleYamlFiles}
        activePage="home"
        onPageChange={onPageChange}
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
      />,
    )

    ref.current!.setDevice('mobile_portrait')
    expect(onDeviceChange).toHaveBeenCalledWith('mobile_portrait')
  })

  it('setMode calls onRenderModeChange', () => {
    const ref = React.createRef<WorkspaceRef>()
    render(
      <Workspace
        ref={ref}
        yamlFiles={sampleYamlFiles}
        activePage="home"
        onPageChange={onPageChange}
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
      />,
    )

    ref.current!.setMode('line')
    expect(onRenderModeChange).toHaveBeenCalledWith('line')
  })

  it('derives page IDs from yamlFiles when pageIds not provided', () => {
    renderWorkspace({ showNavigation: true })
    // Should show page buttons for home and about
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.getByText('about')).toBeInTheDocument()
  })

  it('uses externally provided pageIds', () => {
    renderWorkspace({ showNavigation: true, pageIds: ['custom1', 'custom2'] })
    expect(screen.getByText('custom1')).toBeInTheDocument()
    expect(screen.getByText('custom2')).toBeInTheDocument()
  })
})

describe('PageNavigation', () => {
  it('renders page list', () => {
    const onPageChange = vi.fn()
    render(
      <PageNavigation
        pageIds={['home', 'about', 'contact']}
        activePage="home"
        onPageChange={onPageChange}
      />,
    )
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.getByText('about')).toBeInTheDocument()
    expect(screen.getByText('contact')).toBeInTheDocument()
  })

  it('highlights the active page', () => {
    const onPageChange = vi.fn()
    render(
      <PageNavigation
        pageIds={['home', 'about']}
        activePage="home"
        onPageChange={onPageChange}
      />,
    )
    const homeButton = screen.getByText('home')
    expect(homeButton.closest('button')?.getAttribute('aria-current')).toBe('page')
    const aboutButton = screen.getByText('about')
    expect(aboutButton.closest('button')?.getAttribute('aria-current')).toBeNull()
  })

  it('calls onPageChange when a page is clicked', () => {
    const onPageChange = vi.fn()
    render(
      <PageNavigation
        pageIds={['home', 'about']}
        activePage="home"
        onPageChange={onPageChange}
      />,
    )
    fireEvent.click(screen.getByText('about'))
    expect(onPageChange).toHaveBeenCalledWith('about')
  })

  it('groups pages by prefix', () => {
    const onPageChange = vi.fn()
    render(
      <PageNavigation
        pageIds={['home', 'settings/profile', 'settings/security']}
        activePage="home"
        onPageChange={onPageChange}
      />,
    )
    expect(screen.getByText('settings/')).toBeInTheDocument()
    expect(screen.getByText('profile')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })
})

describe('DeviceControls', () => {
  it('renders device selector and mode toggle', () => {
    const onDeviceChange = vi.fn()
    const onRenderModeChange = vi.fn()
    render(
      <DeviceControls
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
      />,
    )
    expect(screen.getByLabelText('Device')).toBeInTheDocument()
    expect(screen.getByText('Line')).toBeInTheDocument()
    expect(screen.getByText('Card')).toBeInTheDocument()
  })

  it('calls onDeviceChange when device is changed', () => {
    const onDeviceChange = vi.fn()
    render(
      <DeviceControls
        device="web"
        onDeviceChange={onDeviceChange}
        renderMode="card"
        onRenderModeChange={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'mobile_portrait' } })
    expect(onDeviceChange).toHaveBeenCalledWith('mobile_portrait')
  })

  it('calls onRenderModeChange when mode toggle is clicked', () => {
    const onRenderModeChange = vi.fn()
    render(
      <DeviceControls
        device="web"
        onDeviceChange={vi.fn()}
        renderMode="card"
        onRenderModeChange={onRenderModeChange}
      />,
    )
    fireEvent.click(screen.getByText('Line'))
    expect(onRenderModeChange).toHaveBeenCalledWith('line')
  })

  it('shows correct active state for render mode', () => {
    render(
      <DeviceControls
        device="web"
        onDeviceChange={vi.fn()}
        renderMode="line"
        onRenderModeChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Line').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Card').getAttribute('aria-checked')).toBe('false')
  })
})

describe('NodeTree', () => {
  const sampleNodes: ResolvedNode[] = [
    {
      id: 'header',
      type: 'section',
      layout: 'stack',
      children: [
        { id: 'title', type: 'heading', children: [] },
        { id: 'subtitle', type: 'paragraph', children: [] },
      ],
    },
    {
      id: 'content',
      type: 'section',
      layout: 'row',
      children: [],
    },
  ]

  it('renders the tree container', () => {
    render(<NodeTree nodes={sampleNodes} />)
    expect(screen.getByTestId('workspace-node-tree')).toBeInTheDocument()
  })

  it('shows node IDs', () => {
    render(<NodeTree nodes={sampleNodes} />)
    expect(screen.getByText('header')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('shows child nodes', () => {
    render(<NodeTree nodes={sampleNodes} />)
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('subtitle')).toBeInTheDocument()
  })

  it('calls onNodeSelect when a node is clicked', () => {
    const onNodeSelect = vi.fn()
    render(<NodeTree nodes={sampleNodes} onNodeSelect={onNodeSelect} />)
    fireEvent.click(screen.getByText('title'))
    expect(onNodeSelect).toHaveBeenCalledWith('title')
  })

  it('highlights the selected node', () => {
    render(<NodeTree nodes={sampleNodes} selectedNode="header" />)
    const item = screen.getByTestId('node-tree-item-header')
    expect(item.style.borderLeft).toContain('2px solid')
  })

  it('shows empty state when no nodes', () => {
    render(<NodeTree nodes={[]} />)
    expect(screen.getByText('No nodes to display')).toBeInTheDocument()
  })

  it('collapses and expands children', () => {
    render(<NodeTree nodes={sampleNodes} />)
    // Children should be visible initially (depth < 2)
    expect(screen.getByText('title')).toBeInTheDocument()
    // Click collapse button on header
    const collapseBtn = screen.getByTestId('node-tree-item-header')
      .querySelector('button[aria-label="Collapse"]')
    expect(collapseBtn).toBeInTheDocument()
    fireEvent.click(collapseBtn!)
    // Children should be hidden
    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })
})

describe('SitemapView', () => {
  const sampleSitemapNodes: SitemapNode[] = [
    { id: 'home', page: 'home', path: '/', targets: ['about'] },
    { id: 'about', page: 'about', path: '/about', targets: [] },
  ]

  it('renders the sitemap container', () => {
    render(
      <SitemapView
        nodes={sampleSitemapNodes}
        activePage="home"
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('workspace-sitemap-view')).toBeInTheDocument()
  })

  it('renders sitemap nodes', () => {
    render(
      <SitemapView
        nodes={sampleSitemapNodes}
        activePage="home"
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('sitemap-node-home')).toBeInTheDocument()
    expect(screen.getByTestId('sitemap-node-about')).toBeInTheDocument()
  })

  it('calls onPageChange when a node is clicked', () => {
    const onPageChange = vi.fn()
    render(
      <SitemapView
        nodes={sampleSitemapNodes}
        activePage="home"
        onPageChange={onPageChange}
      />,
    )
    fireEvent.click(screen.getByTestId('sitemap-node-about'))
    expect(onPageChange).toHaveBeenCalledWith('about')
  })

  it('shows empty state when no routes', () => {
    render(
      <SitemapView
        nodes={[]}
        activePage="home"
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByText('No routes defined')).toBeInTheDocument()
  })
})
