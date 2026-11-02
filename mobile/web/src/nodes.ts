import { isObject, Project, type Doc, type Node } from './project.js';

export interface Located {
  node: Node;
  /** The array holding the node, and where. */
  list: Node[];
  index: number;
  address: string;
}

const CHILD_KEYS = ['children', 'content', 'regions', 'slots', 'overlays', 'injectables'];

function searchList(list: unknown, id: string, address: string): Located | null {
  if (!Array.isArray(list)) return null;
  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index];
    if (!isObject(entry)) continue;
    if (entry.id === id) return { node: entry, list: list as Node[], index, address };
    const nested = searchNode(entry, id, address);
    if (nested) return nested;
  }
  return null;
}

function searchNode(node: Node, id: string, address: string): Located | null {
  for (const key of CHILD_KEYS) {
    const found = searchList(node[key], id, address);
    if (found) return found;
  }
  return null;
}

function roots(project: Project, address: string): Node | null {
  const [kind, name] = address.split(':');
  if (kind === 'page') {
    const document = project.pageDocument(name);
    return document && isObject(document.page) ? (document.page as Node) : null;
  }
  if (kind === 'template') return project.collection('templates')[name] ?? null;
  if (kind === 'component') {
    const component = project.collection('components')[name];
    return component ?? null;
  }
  return null;
}

/** Every document that can hold nodes, the current page first. */
function addresses(project: Project, firstPage: string | null): string[] {
  const pages = project.pageDocuments().map((document) => `page:${document.id}`);
  const ordered = firstPage ? [`page:${firstPage}`, ...pages.filter((entry) => entry !== `page:${firstPage}`)] : pages;
  return [
    ...ordered,
    ...Object.keys(project.collection('templates')).map((id) => `template:${id}`),
    ...Object.keys(project.collection('components')).map((id) => `component:${id}`),
  ];
}

/** Find a node by id, in one document or else across the project. */
export function findNode(project: Project, id: string, document: string | null, firstPage: string | null): Located | null {
  const searched = document ? [document] : addresses(project, firstPage);
  for (const address of searched) {
    const root = roots(project, address);
    if (!root) continue;
    const found = searchNode(root, id, address);
    if (found) return found;
    if (address.startsWith('component:') && isObject(root.root)) {
      const inRoot = searchNode(root.root as Node, id, address);
      if (inRoot) return inRoot;
    }
  }
  return null;
}

/** The slot a page's content goes in, by slot id. */
export function findSlot(pageDocument: Doc | undefined, slotId: string | null): Node | null {
  const page = pageDocument && isObject(pageDocument.page) ? pageDocument.page : null;
  if (!page || !Array.isArray(page.slots)) return null;
  const slots = page.slots as Node[];
  return slots.find((slot) => slot.slotId === slotId) ?? slots[0] ?? null;
}

export function collectIds(value: unknown, into: Map<string, number>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectIds(entry, into));
    return;
  }
  if (!isObject(value)) return;
  if (typeof value.id === 'string') into.set(value.id, (into.get(value.id) ?? 0) + 1);
  for (const [key, entry] of Object.entries(value)) {
    if (key !== 'props') collectIds(entry, into);
  }
}
