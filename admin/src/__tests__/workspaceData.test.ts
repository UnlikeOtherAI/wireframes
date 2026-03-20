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

  it('extracts nodes from page body', () => {
    const yamlFiles = {
      'pages/home.yaml': [
        'documentType: page',
        'id: home',
        'page:',
        '  template: main',
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
    expect(result.current[0].type).toBe('section')
    expect(result.current[0].children).toHaveLength(1)
    expect(result.current[0].children[0].id).toBe('title')
    expect(result.current[1].id).toBe('footer')
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
        '  template: main',
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
