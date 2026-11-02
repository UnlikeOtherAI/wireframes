import yaml from 'js-yaml';

// @ts-expect-error CJS module without type declarations
import * as engineBuild from '../../../engine/build/index.js';
// @ts-expect-error CJS module without type declarations
import * as engineValidate from '../../../engine/validate/index.js';

// @ts-expect-error CJS module without type declarations
import * as primitiveRegistry from '../../../engine/schema/primitive-registry/index.js';

import { collectIds, findNode, findSlot } from './nodes.js';
import { humanize, isObject, Project, type Node } from './project.js';

const { renderPage } = engineBuild as {
  renderPage: (map: unknown, page: string, options: Record<string, unknown>) => { ok: boolean; error?: string };
};
const { validateProject } = engineValidate as {
  validateProject: (map: unknown) => { ok: boolean; errors: Array<{ code?: string; message: string }> };
};

const { resolvePrimitiveName } = primitiveRegistry as { resolvePrimitiveName: (name: string) => string | null };

export interface Diagnostic {
  code: string;
  message: string;
}

export interface EditResult {
  ok: boolean;
  wf?: string;
  /** The page to show after this edit. */
  page?: string;
  changes?: string[];
  diagnostics: Diagnostic[];
}

const SETTABLE_ROOTS = new Set(['props', 'layout', 'size', 'surface', 'role', 'interaction', 'visibility', 'wireframeStyle', 'component']);
const MAX_CHANGES = 40;

class EditError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Models often wrap their answer in a fence or add a sentence around it. */
function extractYaml(output: string): string {
  const fenced = output.match(/```(?:ya?ml)?\s*\n([\s\S]*?)```/);
  if (fenced) return fenced[1];
  const start = output.search(/^changes:/m);
  return start >= 0 ? output.slice(start) : output;
}

function parseEnvelope(output: string): Node[] {
  let parsed: unknown;
  try {
    parsed = yaml.load(extractYaml(output), { schema: yaml.CORE_SCHEMA });
  } catch (error) {
    throw new EditError('INVALID_YAML', error instanceof Error ? error.message.split('\n')[0] : 'Invalid YAML.');
  }
  if (!isObject(parsed) || !Array.isArray(parsed.changes)) {
    throw new EditError('INVALID_ENVELOPE', 'Expected a top-level "changes" list.');
  }
  if (parsed.changes.length === 0) throw new EditError('NO_CHANGES', 'The "changes" list is empty.');
  if (parsed.changes.length > MAX_CHANGES) throw new EditError('TOO_MANY_CHANGES', `At most ${MAX_CHANGES} changes are allowed.`);
  return parsed.changes.map((change, index) => {
    if (!isObject(change)) throw new EditError('INVALID_CHANGE', `Change ${index + 1} is not a mapping.`);
    return change;
  });
}

function requireString(change: Node, key: string): string {
  const value = change[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EditError('MISSING_FIELD', `Change "${String(change.op)}" needs "${key}".`);
  }
  return value.trim();
}

/** Models write main.footer or page:home#footer for footer. */
function nodeRef(value: string): string {
  return value.trim().split(/[.#]/).pop() as string;
}

function pageIds(project: Project, pageId: string): string {
  const document = project.pageDocument(pageId);
  const ids = new Map<string, number>();
  if (document) collectIds(document.page, ids);
  return [...ids.keys()].filter((id) => id !== pageId).join(', ') || 'none yet';
}

function setPath(target: Node, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0 || !SETTABLE_ROOTS.has(segments[0])) {
    throw new EditError('PATH_NOT_ALLOWED', `Cannot set "${path}". Paths start with ${[...SETTABLE_ROOTS].join(', ')}.`);
  }
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    if (!isObject(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment] as Node;
  }
  const last = segments[segments.length - 1];
  if (value === null) delete cursor[last];
  else cursor[last] = value;
}

/** A link is an interaction to the engine, but a prop is what a model writes. */
function liftRoute(node: Node): void {
  const props = isObject(node.props) ? node.props : null;
  if (!props || typeof props.route !== 'string') return;
  const target = props.route.trim().replace(/^\//, '');
  delete props.route;
  node.interaction = [{ type: 'navigation', targetRoute: target }];
}

/** Spacing is the engine's job, and a model tends to write it as "16px". */
function dropBadSpacing(node: Node): void {
  const props = isObject(node.props) ? node.props : null;
  if (!props) return;
  for (const key of ['gap', 'padding']) {
    if (key in props && typeof props[key] !== 'number') delete props[key];
  }
}

/** Give any node the model left unnamed an id, without colliding with what exists. */
function nameNodes(value: unknown, used: Map<string, number>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => nameNodes(entry, used));
    return;
  }
  if (!isObject(value)) return;
  liftRoute(value);
  dropBadSpacing(value);
  if (typeof value.component === 'string' || typeof value.use === 'string') {
    if (typeof value.id !== 'string' || value.id.trim() === '') {
      const base = String(value.component ?? value.use).replace(/[^a-zA-Z0-9_]/g, '_');
      let suffix = 1;
      while (used.has(`${base}_${suffix}`)) suffix += 1;
      value.id = `${base}_${suffix}`;
      used.set(value.id as string, 1);
    }
  }
  if (Array.isArray(value.children)) nameNodes(value.children, used);
}

function projectIds(project: Project): Map<string, number> {
  const used = new Map<string, number>();
  for (const page of project.pageDocuments()) collectIds(page.page, used);
  collectIds(project.collection('templates'), used);
  return used;
}

function nodeList(value: unknown): Node[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry) => {
    if (!isObject(entry)) throw new EditError('INVALID_NODE', '"value" must be a node or a list of nodes.');
    return entry;
  });
}

function defaultTemplate(project: Project): string {
  const sitemap = project.documentOfType('sitemap');
  const data = sitemap && isObject(sitemap.sitemap) ? sitemap.sitemap : sitemap;
  const named = data && typeof data.defaultTemplate === 'string' ? data.defaultTemplate : null;
  return named ?? Object.keys(project.collection('templates'))[0];
}

function slotOf(project: Project, templateId: string): string {
  const template = project.collection('templates')[templateId];
  const regions = template && Array.isArray(template.regions) ? (template.regions as Node[]) : [];
  const slot = regions.find((region) => region.kind === 'slot');
  if (!slot) throw new EditError('NO_SLOT', `Template "${templateId}" has no slot for page content.`);
  return String(slot.id);
}

function addPage(project: Project, change: Node, used: Map<string, number>): string {
  const id = requireString(change, 'id');
  if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new EditError('INVALID_ID', `Page id "${id}" must be lower case with underscores.`);
  if (project.pageDocument(id)) throw new EditError('DUPLICATE_PAGE', `Page "${id}" already exists.`);
  const template = typeof change.template === 'string' ? change.template : defaultTemplate(project);
  const content = change.content === undefined ? [] : nodeList(change.content);
  nameNodes(content, used);
  project.documents.push({
    documentType: 'page',
    specVersion: '1.1',
    id,
    page: {
      id,
      title: typeof change.title === 'string' ? change.title : humanize(id),
      template,
      viewport: { device: 'web' },
      slots: [{ slotId: slotOf(project, template), content }],
    },
  });
  const routes = project.mutableRoutes();
  const path = typeof change.path === 'string' ? change.path : `/${id}`;
  routes.push({ id, path, page: id, template });
  return id;
}

function removePage(project: Project, id: string): void {
  if (!project.pageDocument(id)) throw new EditError('UNKNOWN_PAGE', `There is no page "${id}".`);
  if (project.pageDocuments().length === 1) throw new EditError('LAST_PAGE', 'A project needs at least one page.');
  project.documents = project.documents.filter((document) => !(document.documentType === 'page' && document.id === id));
  const routes = project.mutableRoutes();
  for (let index = routes.length - 1; index >= 0; index -= 1) {
    if (routes[index].page === id) routes.splice(index, 1);
  }
}

function applyChange(project: Project, change: Node, currentPage: string, used: Map<string, number>): { page?: string; summary: string } {
  const op = requireString(change, 'op');
  const document = typeof change.document === 'string' ? change.document : null;
  const locate = (id: string) => {
    const found = findNode(project, id, document, currentPage);
    if (!found) throw new EditError('UNKNOWN_NODE', `There is no node "${id}". The ids on this page are: ${pageIds(project, currentPage)}.`);
    return found;
  };
  // A new node needs a place, and the end of the page is a good one when the place
  // named does not exist. Nothing is lost, unlike changing or removing a wrong node.
  const appendToSlot = (nodes: Node[]) => {
    const slot = findSlot(project.pageDocument(currentPage), null);
    if (!slot) throw new EditError('NO_SLOT', 'This page has nowhere to add content.');
    if (!Array.isArray(slot.content)) slot.content = [];
    (slot.content as Node[]).push(...nodes);
  };

  switch (op) {
    case 'set': {
      const id = nodeRef(requireString(change, 'node'));
      setPath(locate(id).node, requireString(change, 'path'), change.value);
      return { summary: `Changed ${humanize(id)}` };
    }
    case 'insertAfter': {
      const id = nodeRef(requireString(change, 'node'));
      const nodes = nodeList(change.value);
      nameNodes(nodes, used);
      const found = findNode(project, id, document, currentPage);
      if (found) found.list.splice(found.index + 1, 0, ...nodes);
      else appendToSlot(nodes);
      return { summary: `Added ${humanize(String(nodes[0].id))}` };
    }
    case 'append': {
      const nodes = nodeList(change.value);
      nameNodes(nodes, used);
      const target = typeof change.node === 'string' ? nodeRef(change.node) : '';
      // A slot shares its id with the template region it fills, and the page's own
      // content is what is meant, so the slot is tried before any node.
      const slot = findSlot(project.pageDocument(currentPage), target || null);
      if (slot && (!target || slot.slotId === target)) {
        if (!Array.isArray(slot.content)) slot.content = [];
        (slot.content as Node[]).push(...nodes);
      } else {
        const found = findNode(project, target, document, currentPage);
        if (found) {
          if (!Array.isArray(found.node.children)) found.node.children = [];
          (found.node.children as Node[]).push(...nodes);
        } else {
          appendToSlot(nodes);
        }
      }
      return { summary: `Added ${humanize(String(nodes[0].id))}` };
    }
    case 'remove': {
      const id = nodeRef(requireString(change, 'node'));
      const found = locate(id);
      found.list.splice(found.index, 1);
      return { summary: `Removed ${humanize(id)}` };
    }
    case 'addPage': {
      const id = addPage(project, change, used);
      return { page: id, summary: `Added the ${humanize(id)} page` };
    }
    case 'removePage': {
      const id = requireString(change, 'id');
      removePage(project, id);
      return { page: project.pageDocument(currentPage) ? currentPage : String(project.pageDocuments()[0].id), summary: `Removed the ${humanize(id)} page` };
    }
    default:
      throw new EditError('UNKNOWN_OP', `Unknown op "${op}". Use set, insertAfter, append, remove, addPage or removePage.`);
  }
}

function checkRoutes(project: Project): Diagnostic[] {
  const known = new Set(project.routes().map((route) => route.id));
  const diagnostics: Diagnostic[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObject(value)) return;
    for (const target of [value.route, value.targetRoute]) {
      if (typeof target === 'string' && !known.has(target)) {
        diagnostics.push({ code: 'UNKNOWN_ROUTE', message: `Link to "${target}", which is not a valid page id.` });
      }
    }
    Object.values(value).forEach(visit);
  };
  project.pageDocuments().forEach((page) => visit(page.page));
  visit(project.collection('templates'));
  return diagnostics;
}

function checkElements(project: Project): Diagnostic[] {
  const components = project.collection('components');
  const diagnostics: Diagnostic[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObject(value)) return;
    if (typeof value.component === 'string' && !resolvePrimitiveName(value.component)) {
      diagnostics.push({ code: 'UNKNOWN_ELEMENT', message: `"${value.component}" is not an element.` });
    }
    if (typeof value.use === 'string' && !components[value.use]) {
      diagnostics.push({ code: 'UNKNOWN_COMPONENT', message: `There is no component "${value.use}".` });
    }
    for (const [key, entry] of Object.entries(value)) {
      if (key !== 'props') visit(entry);
    }
  };
  project.pageDocuments().forEach((page) => visit(page.page));
  return diagnostics;
}

/**
 * In a wireframe a link to a page nobody has drawn yet should still go somewhere, so
 * it gets an empty page to land on. Anything that cannot be a page id stays an error.
 */
function createLinkedPages(project: Project, used: Map<string, number>): string[] {
  const created: string[] = [];
  const known = new Set(project.routes().map((route) => route.id));
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObject(value)) return;
    for (const target of [value.route, value.targetRoute]) {
      if (typeof target === 'string' && !known.has(target) && /^[a-z][a-z0-9_]*$/.test(target)) {
        known.add(target);
        created.push(target);
      }
    }
    Object.values(value).forEach(visit);
  };
  project.pageDocuments().forEach((page) => visit(page.page));
  visit(project.collection('templates'));
  for (const id of created) {
    addPage(project, { id, content: [{ id: `${id}_title`, component: 'heading', props: { text: humanize(id), level: 1 } }] }, used);
  }
  return created;
}

function checkDuplicates(project: Project): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const page of project.pageDocuments()) {
    const ids = new Map<string, number>();
    collectIds(page.page, ids);
    for (const [id, count] of ids) {
      if (count > 1) diagnostics.push({ code: 'DUPLICATE_ID', message: `Node id "${id}" is used ${count} times on page "${page.id}".` });
    }
  }
  return diagnostics;
}

function validate(project: Project): Diagnostic[] {
  const map = project.documentMap();
  const result = validateProject(map);
  const diagnostics: Diagnostic[] = result.errors.map((error) => ({ code: error.code ?? 'INVALID', message: error.message }));
  diagnostics.push(...checkElements(project), ...checkDuplicates(project), ...checkRoutes(project));
  if (diagnostics.length > 0) return diagnostics;
  for (const page of project.pageDocuments()) {
    const rendered = renderPage(map, String(page.id), { routeTable: project.routeTable(), assetUrlPrefix: '' });
    if (!rendered.ok) diagnostics.push({ code: 'RENDER_FAILED', message: rendered.error ?? `Page "${page.id}" would not render.` });
  }
  return diagnostics;
}

/**
 * Apply a model's YAML edit to a copy of the project. Either every change lands
 * and the result validates and renders, or nothing changes and the diagnostics
 * say why, in a form short enough to give back to the model.
 */
export function applyEdit(wf: string, output: string, currentPage: string): EditResult {
  try {
    const changes = parseEnvelope(output);
    const project = Project.parse(wf);
    const used = projectIds(project);
    // Every change is about the page the user was looking at, even after an addPage.
    let page = currentPage;
    const summaries: string[] = [];
    for (const change of changes) {
      const applied = applyChange(project, change, currentPage, used);
      if (applied.page) page = applied.page;
      summaries.push(applied.summary);
    }
    createLinkedPages(project, used);
    if (!project.pageDocument(page)) page = String(project.pageDocuments()[0].id);
    const diagnostics = validate(project);
    if (diagnostics.length > 0) return { ok: false, diagnostics };
    return { ok: true, wf: project.serialize(), page, changes: summaries, diagnostics: [] };
  } catch (error) {
    if (error instanceof EditError) return { ok: false, diagnostics: [{ code: error.code, message: error.message }] };
    return { ok: false, diagnostics: [{ code: 'EDIT_FAILED', message: error instanceof Error ? error.message : String(error) }] };
  }
}
