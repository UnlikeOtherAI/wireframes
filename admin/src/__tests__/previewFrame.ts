import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import { parse } from 'yaml'
// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
import * as addressing from '../../../engine/addressing/index.js'

// What the mounted Workspace and Project Editor tests do to the real preview:
// load the rendered page into the frame, click a rendered node, and find what
// an address names in the document it is written in.

type Resolved = { ok: boolean; targetType?: string; node?: Record<string, unknown>; item: Record<string, unknown>; index: number; error?: string }
const { parseAddress, buildPageRoots, buildTemplateRoots, buildComponentRootsFromMap, resolveAddressInRoots } = addressing as {
  parseAddress: (address: string) => { ok: boolean; doctype: string; documentId: string; pathSegments: string[] }
  buildPageRoots: (pageDoc: unknown, pageId: string) => { ok: boolean; roots: unknown[] }
  buildTemplateRoots: (template: unknown, templateId: string) => { ok: boolean; roots: unknown[] }
  buildComponentRootsFromMap: (components: unknown, id: string) => { ok: boolean; roots: unknown[] }
  resolveAddressInRoots: (roots: unknown[], segments: string[]) => Resolved
}

/** Waits for the rendered page, then loads it into the frame as a browser loads `srcdoc`. */
export async function loadPreview(expected: string): Promise<HTMLIFrameElement> {
  const frame = await screen.findByTestId('workspace-preview-iframe', undefined, { timeout: 15000 }) as HTMLIFrameElement
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
export async function clickRendered(frame: HTMLIFrameElement, renderedId: string) {
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

export const outline = (frame: HTMLIFrameElement, renderedId: string) =>
  frame.contentDocument!.getElementById(renderedId)!.style.outline

export const treeItems = (id: string) =>
  within(screen.getByTestId('workspace-node-tree')).queryAllByTestId(`node-tree-item-${id}`)

/** Opens every collapsed tree item. */
export function expandAll() {
  const tree = screen.getByTestId('workspace-node-tree')
  for (let toggle = within(tree).queryAllByRole('button', { name: 'Expand' }); toggle.length > 0; toggle = within(tree).queryAllByRole('button', { name: 'Expand' })) {
    toggle.forEach((button) => fireEvent.click(button))
  }
}

/** Selects a tree item. */
export function clickTreeItem(item: HTMLElement) {
  fireEvent.click(within(item).getAllByRole('button').at(-1)!)
}

/** The ids a tree item lists directly below it. */
export function treeChildren(item: HTMLElement): string[] {
  const group = [...item.parentElement!.children].find((child) => child.getAttribute('role') === 'group')
  if (!group) return []
  return [...group.children].map((child) => child.firstElementChild!.getAttribute('data-testid')!.replace('node-tree-item-', ''))
}

/** The node an address names, found the way `wf node` finds it, in the document it is written in. */
export function nodeAt(yamlFiles: Record<string, string>, address: string): Resolved {
  const parsed = parseAddress(address)
  expect(parsed.ok).toBe(true)
  const roots = parsed.doctype === 'page'
    ? buildPageRoots(parse(yamlFiles[`pages/${parsed.documentId}.yaml`]), parsed.documentId)
    : parsed.doctype === 'template'
      ? buildTemplateRoots(parse(yamlFiles['templates.yaml']).templates[parsed.documentId], parsed.documentId)
      : buildComponentRootsFromMap(parse(yamlFiles['components.yaml']).components, parsed.documentId)
  const resolved = resolveAddressInRoots(roots.roots, parsed.pathSegments)
  expect(resolved.ok, `${address}: ${resolved.error}`).toBe(true)
  return resolved
}
