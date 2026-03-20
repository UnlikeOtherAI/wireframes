import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResolvedNodes, useSitemapNodes } from '../features/workspace/useWorkspaceData'

describe('useResolvedNodes', () => {
  it('returns empty array when page file is missing', () => {
    const { result } = renderHook(() =>
      useResolvedNodes({}, 'missing'),
    )
    expect(result.current).toEqual([])
  })

  it('extracts nodes from page body with addresses', () => {
    const yamlFiles = {
      'pages/home.yaml': [
        'documentType: page',
        'id: home',
        'page:',
        '  body:',
        '    - id: header',
        '      type: section',
        '      children:',
        '        - id: title',
        '          type: heading',
        '    - id: footer',
        '      type: section',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useResolvedNodes(yamlFiles, 'home'),
    )

    expect(result.current).toHaveLength(2)
    expect(result.current[0].id).toBe('header')
    expect(result.current[0].address).toBe('wf://page/home#header')
    expect(result.current[0].type).toBe('section')
    expect(result.current[0].children).toHaveLength(1)
    expect(result.current[0].children[0].id).toBe('title')
    expect(result.current[0].children[0].address).toBe('wf://page/home#header.title')
    expect(result.current[1].id).toBe('footer')
    expect(result.current[1].address).toBe('wf://page/home#footer')
  })

  it('handles malformed YAML gracefully', () => {
    const yamlFiles = {
      'pages/bad.yaml': 'this is not: valid: yaml: [[[',
    }

    const { result } = renderHook(() =>
      useResolvedNodes(yamlFiles, 'bad'),
    )
    expect(result.current).toEqual([])
  })

  it('extracts layout type from node', () => {
    const yamlFiles = {
      'pages/test.yaml': [
        'documentType: page',
        'id: test',
        'page:',
        '  body:',
        '    - id: row1',
        '      type: section',
        '      layout:',
        '        type: row',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useResolvedNodes(yamlFiles, 'test'),
    )

    expect(result.current[0].layout).toBe('row')
  })

  it('resolves template regions with slots', () => {
    const yamlFiles = {
      'templates.yaml': [
        'documentType: templates',
        'id: templates',
        'templates:',
        '  main:',
        '    regions:',
        '      - id: sidebar',
        '        kind: persistent',
        '        children:',
        '          - id: logo',
        '            type: image',
        '      - id: main_content',
        '        kind: slot',
      ].join('\n'),
      'pages/dash.yaml': [
        'documentType: page',
        'id: dash',
        'page:',
        '  template: main',
        '  slots:',
        '    - slotId: main_content',
        '      body:',
        '        - id: hero',
        '          type: section',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useResolvedNodes(yamlFiles, 'dash'),
    )

    // Should have sidebar (persistent) and main_content (slot filled)
    expect(result.current.length).toBeGreaterThanOrEqual(2)
    const sidebar = result.current.find(n => n.id === 'sidebar')
    expect(sidebar).toBeDefined()
    expect(sidebar!.children.some(c => c.id === 'logo')).toBe(true)
    const mainContent = result.current.find(n => n.id === 'main_content')
    expect(mainContent).toBeDefined()
    expect(mainContent!.children.some(c => c.id === 'hero')).toBe(true)
  })

  it('resolves components from components.yaml', () => {
    const yamlFiles = {
      'components.yaml': [
        'documentType: components',
        'id: components',
        'components:',
        '  card:',
        '    root:',
        '      id: card_root',
        '      type: section',
        '      children:',
        '        - id: card_title',
        '          type: heading',
      ].join('\n'),
      'pages/home.yaml': [
        'documentType: page',
        'id: home',
        'page:',
        '  body:',
        '    - id: my_card',
        '      use: card',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useResolvedNodes(yamlFiles, 'home'),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('my_card')
    expect(result.current[0].children.some(c => c.id === 'card_title')).toBe(true)
  })

  it('includes overlays in node tree', () => {
    const yamlFiles = {
      'pages/home.yaml': [
        'documentType: page',
        'id: home',
        'page:',
        '  body:',
        '    - id: main',
        '      type: section',
        '  overlays:',
        '    - id: modal1',
        '      type: modal',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useResolvedNodes(yamlFiles, 'home'),
    )

    expect(result.current.some(n => n.id === 'modal1')).toBe(true)
  })
})

describe('useSitemapNodes', () => {
  it('returns empty array when sitemap is missing', () => {
    const { result } = renderHook(() =>
      useSitemapNodes({}),
    )
    expect(result.current).toEqual([])
  })

  it('extracts routes from sitemap', () => {
    const yamlFiles = {
      'sitemap.yaml': [
        'documentType: sitemap',
        'sitemap:',
        '  routes:',
        '    - id: home',
        '      page: home',
        '      path: /',
        '    - id: about',
        '      page: about',
        '      path: /about',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useSitemapNodes(yamlFiles),
    )

    expect(result.current).toHaveLength(2)
    expect(result.current[0]).toEqual({
      id: 'home',
      page: 'home',
      path: '/',
      targets: [],
    })
    expect(result.current[1]).toEqual({
      id: 'about',
      page: 'about',
      path: '/about',
      targets: [],
    })
  })

  it('extracts navigation targets', () => {
    const yamlFiles = {
      'sitemap.yaml': [
        'documentType: sitemap',
        'sitemap:',
        '  routes:',
        '    - id: home',
        '      page: home',
        '      path: /',
        '      navigate: about',
      ].join('\n'),
    }

    const { result } = renderHook(() =>
      useSitemapNodes(yamlFiles),
    )

    expect(result.current[0].targets).toContain('about')
  })

  it('handles malformed sitemap gracefully', () => {
    const yamlFiles = {
      'sitemap.yaml': 'not valid yaml: [[[',
    }

    const { result } = renderHook(() =>
      useSitemapNodes(yamlFiles),
    )
    expect(result.current).toEqual([])
  })
})
