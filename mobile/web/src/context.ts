import yaml from 'js-yaml';

import { findNode } from './nodes.js';
import { isObject, Project, type Node } from './project.js';

// @ts-expect-error CJS module without type declarations
import * as primitiveRegistry from '../../../engine/schema/primitive-registry/index.js';

const { PRIMITIVES } = primitiveRegistry as {
  PRIMITIVES: Array<{ name: string; summary?: string; example?: string; props?: Record<string, { enum?: string[] }> }>;
};

// Props the model never needs on a phone-sized context budget.
const SKIPPED_PROPS = new Set(['iconStyle', 'iconSize', 'loading', 'disabled', 'state', 'nowrap', 'wrap', 'gap', 'padding', 'minItemWidth']);

// Elements whose props hold lists. A name alone does not tell the model their shape.
const SHOW_EXAMPLE = new Set(['table', 'list', 'tab_bar', 'bottom_tab_bar', 'nav', 'menu', 'breadcrumb', 'stepper', 'select', 'segmented', 'accordion', 'kanban', 'page_header', 'app_bar', 'stat']);

/** Every element and the props it takes, one line each, from the registry itself. */
export function elementSheet(): string {
  return PRIMITIVES.map((primitive) => {
    const props = Object.entries(primitive.props ?? {})
      .filter(([name]) => !SKIPPED_PROPS.has(name))
      .map(([name, spec]) => (spec.enum && spec.enum.length <= 5 ? `${name}(${spec.enum.join('|')})` : name));
    const example = SHOW_EXAMPLE.has(primitive.name) && primitive.example
      ? ` e.g. ${primitive.example.replace(/^- \w+: /, '')}`
      : '';
    return `${primitive.name}: ${props.join(', ')}${example}`;
  }).join('\n');
}

export interface ModelContext {
  /** Every page and its route, one line each. */
  pages: string;
  /** The current page as an outline of ids. */
  outline: string;
  /** The YAML of the node the user selected, or an empty string. */
  selected: string;
  /** Whether editing the selection affects every place it is used. */
  shared: boolean;
}

function labelOf(node: Node): string {
  const props = isObject(node.props) ? node.props : {};
  for (const key of ['title', 'text', 'label', 'name']) {
    if (typeof props[key] === 'string') return ` "${String(props[key]).slice(0, 40)}"`;
  }
  return '';
}

function outlineNodes(nodes: unknown, depth: number, lines: string[]): void {
  if (!Array.isArray(nodes)) return;
  for (const entry of nodes) {
    if (!isObject(entry)) continue;
    const kind = entry.use ? `use ${String(entry.use)}` : String(entry.component ?? entry.kind ?? 'node');
    lines.push(`${'  '.repeat(depth)}- ${String(entry.id ?? '?')} (${kind})${labelOf(entry)}`);
    outlineNodes(entry.children, depth + 1, lines);
  }
}

function outlineOf(project: Project, pageId: string): string {
  const document = project.pageDocument(pageId);
  const page = document && isObject(document.page) ? document.page : null;
  if (!page) return '';
  const lines: string[] = [];
  const slots = Array.isArray(page.slots) ? (page.slots as Node[]) : [];
  for (const slot of slots) {
    const empty = !Array.isArray(slot.content) || slot.content.length === 0;
    lines.push(`slot ${String(slot.slotId)}:${empty ? ' (empty)' : ''}`);
    outlineNodes(slot.content, 1, lines);
  }
  if (Array.isArray(page.overlays)) {
    lines.push('overlays:');
    outlineNodes(page.overlays, 1, lines);
  }
  return lines.join('\n');
}

function parseSource(source: string | null): { document: string; id: string } | null {
  if (!source) return null;
  const hash = source.indexOf('#');
  return hash < 0 ? null : { document: source.slice(0, hash), id: source.slice(hash + 1) };
}

/** What the model needs to see for one request. Never the whole project. */
export function contextFor(wf: string, pageId: string, source: string | null): ModelContext {
  const project = Project.parse(wf);
  const pages = project.pages().map((page) => `${page.id}${page.id === pageId ? ' (current)' : ''}: ${page.title}`).join('\n');
  const target = parseSource(source);
  const located = target ? findNode(project, target.id, target.document, pageId) : null;
  return {
    pages,
    outline: outlineOf(project, pageId),
    selected: located ? yaml.dump(located.node, { lineWidth: 100, noRefs: true }) : '',
    shared: Boolean(target && !target.document.startsWith('page:')),
  };
}
