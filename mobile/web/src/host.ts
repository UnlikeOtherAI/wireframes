// @ts-expect-error CJS module without type declarations
import * as engineBuild from '../../../engine/build/index.js';

import { contextFor, elementSheet } from './context.js';
import { applyEdit } from './edit.js';
import { isObject, Project } from './project.js';
import { newProject } from './seed.js';

const { renderPage } = engineBuild as {
  renderPage: (map: unknown, page: string, options: Record<string, unknown>) => { ok: boolean; error?: string; html?: string };
};

type Pointing = 'tap' | 'longpress' | 'none';

interface Viewport {
  device: 'web' | 'tablet' | 'mobile';
  orientation?: 'portrait' | 'landscape';
  width?: number;
  height?: number;
}

/** How a project's pages are drawn. A view setting: it is never written to the project. */
interface Rendering {
  corners: 'rounded' | 'square';
  mode: 'card' | 'line';
  adapt: boolean;
}

interface Selection {
  id: string;
  source: string;
  definition: string | null;
  row: number | null;
  label: string;
  shared: boolean;
}

const ICONS_CSS = 'wf-app://web/fa/css/all.min.css';
const BLOCKED_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];

let project: Project | null = null;
let pageId = '';
let viewport: Viewport = { device: 'web' };
let pointing: Pointing = 'none';
let accent = '#A0634A';
let frame: HTMLIFrameElement | null = null;
let renderToken = 0;
let selection: Selection | null = null;
let suppressClick = false;
let rendering: Rendering = { corners: 'rounded', mode: 'card', adapt: true };

function post(message: Record<string, unknown>): void {
  const handlers = (window as unknown as { webkit?: { messageHandlers?: { wf?: { postMessage: (m: unknown) => void } } } }).webkit?.messageHandlers;
  handlers?.wf?.postMessage(message);
}

function withIcons(html: string): string {
  return html.replace(/<link rel="stylesheet" href="[^"]*fa\/css\/all\.min\.css"\s*\/>/, `<link rel="stylesheet" href="${ICONS_CSS}" />`);
}

function labelFor(element: Element): string {
  const words = element.id.split('__').pop()!.replace(/-\d+$/, '').replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Component';
}

function drawHighlight(doc: Document, element: Element, label: string): void {
  doc.getElementById('wf-host-highlight')?.remove();
  const rect = element.getBoundingClientRect();
  const view = doc.defaultView!;
  const box = doc.createElement('div');
  box.id = 'wf-host-highlight';
  box.setAttribute('style', `position:absolute;z-index:2147483647;pointer-events:none;box-sizing:border-box;border:2px solid ${accent};border-radius:8px;`
    + `left:${rect.left + view.scrollX - 2}px;top:${rect.top + view.scrollY - 2}px;width:${rect.width + 4}px;height:${rect.height + 4}px;`);
  const tag = doc.createElement('span');
  tag.textContent = label;
  tag.setAttribute('style', `position:absolute;right:8px;top:${rect.top + view.scrollY < 14 ? 4 : -12}px;background:${accent};color:#fff;font:600 12px/20px -apple-system,sans-serif;padding:0 8px;border-radius:6px;white-space:nowrap;`);
  box.appendChild(tag);
  doc.body.appendChild(box);
}

function clearHighlight(): void {
  frame?.contentDocument?.getElementById('wf-host-highlight')?.remove();
}

function select(target: EventTarget | null): void {
  const element = (target as Element | null)?.closest?.('[data-wf-source]');
  // The slot is the whole page area. Pressing a gap should not select all of it.
  if (!element || element.classList.contains('wf-root-slot')) return;
  const source = element.getAttribute('data-wf-source') as string;
  const rowElement = element.closest('[data-wf-row]');
  selection = {
    id: element.id,
    source,
    definition: element.getAttribute('data-wf-definition'),
    row: rowElement ? Number(rowElement.getAttribute('data-wf-row')) : null,
    label: labelFor(element),
    shared: !source.startsWith('page:'),
  };
  drawHighlight(element.ownerDocument, element, selection.label);
  post({ type: 'selection', selection });
}

function restoreSelection(doc: Document): void {
  if (!selection) return;
  const element = selection.id ? doc.getElementById(selection.id) : null;
  if (!element || element.getAttribute('data-wf-source') !== selection.source) {
    selection = null;
    post({ type: 'selection', selection: null });
    return;
  }
  drawHighlight(doc, element, selection.label);
}

function hookFrame(target: HTMLIFrameElement): void {
  const view = target.contentWindow!;
  const doc = target.contentDocument!;
  const style = doc.createElement('style');
  style.textContent = '*{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}';
  doc.head.appendChild(style);

  // Selection mode stops the prototype reacting to a touch. Stopping propagation
  // without preventing the default leaves native scrolling alone.
  for (const type of BLOCKED_EVENTS) {
    view.addEventListener(type, (event) => {
      if (pointing === 'tap') event.stopPropagation();
    }, { capture: true, passive: true });
  }

  view.addEventListener('click', (event) => {
    if (pointing === 'tap') {
      event.preventDefault();
      event.stopPropagation();
      select(event.target);
    } else if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });
}

function applyRendering(target: Project): void {
  const manifest = target.documentOfType('manifest');
  if (manifest && isObject(manifest.manifest)) {
    const style = isObject(manifest.manifest.defaultWireframeStyle) ? manifest.manifest.defaultWireframeStyle : {};
    manifest.manifest.defaultWireframeStyle = {
      ...style,
      corner: rendering.corners === 'rounded' ? { style: 'rounded', radius: 10 } : { style: 'sharp' },
    };
  }
  for (const document of target.pageDocuments()) {
    if (isObject(document.page)) document.page.rendering = { ...(isObject(document.page.rendering) ? document.page.rendering : {}), mode: rendering.mode };
  }
}

function render(): void {
  if (!project) return;
  const token = ++renderToken;
  applyRendering(project);
  const result = renderPage(project.documentMap(), pageId, {
    routeTable: project.routeTable(),
    assetUrlPrefix: '',
    annotateSource: true,
    deviceChrome: false,
    adaptive: rendering.adapt,
    viewportOverride: viewport,
  });
  if (!result.ok) {
    post({ type: 'error', message: result.error ?? 'This page could not be rendered.' });
    return;
  }

  const previous = frame;
  const scroll = previous?.contentWindow ? { x: previous.contentWindow.scrollX, y: previous.contentWindow.scrollY, page: previous.dataset.page } : null;
  const next = document.createElement('iframe');
  next.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  next.dataset.page = pageId;
  next.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;opacity:0';
  next.addEventListener('load', () => {
    if (token !== renderToken) {
      next.remove();
      return;
    }
    hookFrame(next);
    if (scroll && scroll.page === pageId) next.contentWindow!.scrollTo(scroll.x, scroll.y);
    next.style.opacity = '1';
    previous?.remove();
    frame = next;
    restoreSelection(next.contentDocument!);
    post({ type: 'rendered', page: pageId, pages: project!.pages() });
  }, { once: true });
  next.srcdoc = withIcons(result.html as string);
  document.body.appendChild(next);
}

window.addEventListener('message', (event) => {
  if (!frame || event.source !== frame.contentWindow) return;
  const data = event.data as { type?: string; routeId?: string } | null;
  if (data?.type !== 'wf:navigate' || !project) return;
  const route = project.routes().find((entry) => entry.id === data.routeId);
  if (route && typeof route.page === 'string' && project.pageDocument(route.page)) {
    pageId = route.page;
    selection = null;
    post({ type: 'selection', selection: null });
    render();
  }
});

const api = {
  load(wf: string, page: string | null): void {
    project = Project.parse(wf);
    const pages = project.pages();
    pageId = page && pages.some((entry) => entry.id === page) ? page : pages[0]?.id ?? '';
    render();
  },
  setPage(page: string): void {
    pageId = page;
    selection = null;
    post({ type: 'selection', selection: null });
    render();
  },
  setViewport(next: Viewport): void {
    viewport = next;
    render();
  },
  setRendering(next: Rendering): void {
    rendering = next;
    render();
  },
  setPointing(next: Pointing): void {
    pointing = next;
  },
  setAccent(next: string): void {
    accent = next;
  },
  /** A long press, from the native gesture. The point is in the page's own coordinates. */
  selectAt(x: number, y: number): void {
    if (pointing !== 'longpress' || !frame?.contentDocument) return;
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 800);
    select(frame.contentDocument.elementFromPoint(x, y));
  },
  clearSelection(): void {
    selection = null;
    clearHighlight();
    post({ type: 'selection', selection: null });
  },
  applyEdit: (wf: string, output: string, page: string) => applyEdit(wf, output, page),
  contextFor: (wf: string, page: string, source: string | null) => contextFor(wf, page, source),
  newProject: (name: string) => newProject(name),
  pagesOf: (wf: string) => Project.parse(wf).pages(),
  elementSheet: () => elementSheet(),
};

(window as unknown as { wfHost: typeof api }).wfHost = api;
post({ type: 'ready' });
