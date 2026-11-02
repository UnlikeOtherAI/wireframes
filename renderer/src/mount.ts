import { parseWf, type WfProject } from './wf.js';

// @ts-expect-error CJS module without type declarations
import * as engineBuildModule from '../../engine/build/index.js';

const { renderPage: engineRenderPage, buildProject } = engineBuildModule as {
  renderPage: (
    documentMap: unknown,
    pageId: string,
    options: { routeTable: Record<string, string>; assetUrlPrefix: string },
  ) => { ok: boolean; error?: string; html?: string }
  buildProject: (
    documentMap: unknown,
    options: { platform: string; basePath: string },
  ) => { ok: boolean; routeTable: Record<string, string> }
};

export type Mode = 'line' | 'card';
export type Platform = 'web' | 'ios' | 'android';

export interface MountOptions {
  page?: string;
  mode?: Mode;
  platform?: Platform;
  /** 'fontawesome' loads the icon font from a URL; 'none' draws lettered glyph boxes. */
  icons?: 'fontawesome' | 'none' | string;
  onNavigate?: (routeId: string) => void;
  onError?: (error: Error) => void;
}

export interface WireframeInstance {
  readonly pageIds: string[];
  readonly routeIds: string[];
  setPage(pageId: string): void;
  navigate(routeId: string): void;
  setMode(mode: Mode): void;
  setPlatform(platform: Platform): void;
  /** The frame decision for a node, as the page actually rendered it. */
  explain(nodeId: string): { frame: string; rule: number | null; reason: string } | null;
  html(): string;
  destroy(): void;
}

type Listener = (event: MessageEvent) => void;

function overrideEachPage(project: WfProject, apply: (page: Record<string, unknown>) => void): void {
  for (const [, pageDoc] of project.documentMap.pages) {
    const page = (pageDoc as Record<string, unknown>).page as Record<string, unknown> | undefined;
    if (page) apply(page);
  }
}

function routeTableOf(project: WfProject): Record<string, string> {
  // Route ids map to page ids, not files: navigation happens in memory.
  const table: Record<string, string> = {};
  const sitemap = project.documentMap.sitemap as Record<string, unknown> | null;
  const data = (sitemap?.sitemap ?? sitemap) as Record<string, unknown> | undefined;
  const routes = Array.isArray(data?.routes) ? (data.routes as Array<Record<string, unknown>>) : [];
  for (const route of routes) {
    const id = typeof route?.id === 'string' ? route.id.trim() : '';
    const page = typeof route?.page === 'string' ? route.page.trim() : '';
    if (id && page) table[id] = `#${page}`;
  }
  return table;
}

/**
 * Render a wireframe into an element and keep it interactive, entirely in the
 * browser. The page runs inside a sandboxed iframe so its stylesheet and runtime
 * cannot reach the host app; navigation comes back as a message.
 */
export function createWireframe(
  container: HTMLElement,
  source: WfProject | string | ArrayBuffer | Uint8Array | Record<string, string>,
  options: MountOptions = {},
): WireframeInstance {
  const project: WfProject = (source as WfProject).documentMap
    ? (source as WfProject)
    : parseWf(source as string);

  if (project.pageIds.length === 0) {
    throw new Error('This project has no pages.');
  }

  let mode: Mode | undefined = options.mode;
  let platform: Platform | undefined = options.platform;
  let pageId = options.page && project.pageIds.includes(options.page) ? options.page : project.pageIds[0];
  let current = '';

  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:transparent';
  container.appendChild(frame);

  const routeTable = routeTableOf(project);
  const pageByRoute = new Map<string, string>();
  for (const [routeId, href] of Object.entries(routeTable)) {
    pageByRoute.set(routeId, href.replace(/^#/, ''));
  }

  function render(): void {
    if (mode) overrideEachPage(project, (page) => {
      page.rendering = { ...(page.rendering as object), mode };
    });
    if (platform) overrideEachPage(project, (page) => {
      page.viewport = { ...(page.viewport as object), platform };
    });

    const result = engineRenderPage(project.documentMap, pageId, { routeTable, assetUrlPrefix: '' });
    if (!result.ok) {
      const error = new Error(result.error || `Could not render page "${pageId}".`);
      if (options.onError) options.onError(error);
      else throw error;
      return;
    }

    current = withIcons(result.html as string, options.icons);
    frame.srcdoc = current;
  }

  const listener: Listener = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; routeId?: string } | null;
    if (!data || data.type !== 'wf:navigate' || typeof data.routeId !== 'string') return;
    const target = pageByRoute.get(data.routeId);
    if (options.onNavigate) options.onNavigate(data.routeId);
    if (target && project.pageIds.includes(target)) {
      pageId = target;
      render();
    }
  };
  window.addEventListener('message', listener);

  render();

  return {
    get pageIds() { return project.pageIds; },
    get routeIds() { return project.routeIds; },
    setPage(next) {
      if (!project.pageIds.includes(next)) throw new Error(`No page "${next}".`);
      pageId = next;
      render();
    },
    navigate(routeId) {
      const target = pageByRoute.get(routeId);
      if (!target) throw new Error(`No route "${routeId}".`);
      this.setPage(target);
    },
    setMode(next) { mode = next; render(); },
    setPlatform(next) { platform = next; render(); },
    explain(nodeId) {
      const match = current.match(new RegExp(`<[a-z]+[^>]*\\sid="${nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i'));
      if (!match) return null;
      const frameAttr = match[0].match(/data-wf-frame="([^"]*)"/);
      const whyAttr = match[0].match(/data-wf-why="(\d+):([^"]*)"/);
      return {
        frame: frameAttr ? frameAttr[1] : 'unknown',
        rule: whyAttr ? Number(whyAttr[1]) : null,
        reason: whyAttr ? whyAttr[2] : '',
      };
    },
    html() { return current; },
    destroy() {
      window.removeEventListener('message', listener);
      frame.remove();
    },
  };
}

const FONT_AWESOME_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';

/**
 * The engine always links a local icon stylesheet, which does not exist when the
 * page is rendered from memory. Point it somewhere real, or drop it and let the
 * lettered glyph fallback do the work.
 */
function withIcons(html: string, icons: MountOptions['icons']): string {
  const href = icons === 'fontawesome'
    ? FONT_AWESOME_CDN
    : (typeof icons === 'string' && icons !== 'none' ? icons : null);
  return href
    ? html.replace(/<link rel="stylesheet" href="[^"]*fa\/css\/all\.min\.css"\s*\/>/, `<link rel="stylesheet" href="${href}" />`)
    : html.replace(/<link rel="stylesheet" href="[^"]*fa\/css\/all\.min\.css"\s*\/>/, '');
}
