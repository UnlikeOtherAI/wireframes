import yaml from 'js-yaml';

// @ts-expect-error CJS module without type declarations
import * as wfFormat from '../../../engine/wf-format/index.js';

const { orderDocuments } = wfFormat as {
  orderDocuments: (documents: unknown[]) => Doc[];
};

export type Doc = Record<string, unknown>;
export type Node = Record<string, unknown>;

export interface PageInfo {
  id: string;
  title: string;
  route: string | null;
  path: string;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** A project held as its parsed documents, which is what gets edited and saved. */
export class Project {
  documents: Doc[];

  constructor(documents: Doc[]) {
    this.documents = documents;
  }

  static parse(wf: string): Project {
    const documents = yaml.loadAll(wf, undefined, { schema: yaml.CORE_SCHEMA }) as unknown[];
    // `format` belongs to the file, not to the manifest document the schema checks.
    return new Project(documents.filter(isObject).map(({ format: _format, ...document }) => document));
  }

  clone(): Project {
    return new Project(JSON.parse(JSON.stringify(this.documents)));
  }

  serialize(): string {
    return orderDocuments(this.documents)
      .map((document) => {
        const output = document.documentType === 'manifest' ? { format: 'wf/1', ...document } : document;
        return yaml.dump(output, { lineWidth: 100, noRefs: true });
      })
      .join('---\n');
  }

  documentOfType(type: string): Doc | undefined {
    return this.documents.find((document) => document.documentType === type);
  }

  pageDocument(id: string): Doc | undefined {
    return this.documents.find((document) => document.documentType === 'page' && document.id === id);
  }

  pageDocuments(): Doc[] {
    return this.documents.filter((document) => document.documentType === 'page');
  }

  /** The maps of templates or components, which may or may not sit under a wrapper key. */
  collection(type: 'templates' | 'components'): Record<string, Node> {
    const document = this.documentOfType(type);
    if (!document) return {};
    const wrapped = document[type];
    return (isObject(wrapped) ? wrapped : document) as Record<string, Node>;
  }

  routes(): Node[] {
    const sitemap = this.documentOfType('sitemap');
    if (!sitemap) return [];
    const data = isObject(sitemap.sitemap) ? sitemap.sitemap : sitemap;
    return Array.isArray(data.routes) ? (data.routes as Node[]) : [];
  }

  /** The array routes live in, created if the sitemap has none yet. */
  mutableRoutes(): Node[] {
    const sitemap = this.documentOfType('sitemap');
    if (!sitemap) throw new Error('This project has no sitemap.');
    const data = isObject(sitemap.sitemap) ? sitemap.sitemap : sitemap;
    if (!Array.isArray(data.routes)) data.routes = [];
    return data.routes as Node[];
  }

  pages(): PageInfo[] {
    const routes = this.routes();
    return this.pageDocuments().map((document) => {
      const id = String(document.id);
      const page = isObject(document.page) ? document.page : {};
      const route = routes.find((entry) => entry.page === id);
      const title = typeof page.title === 'string' && page.title ? page.title : humanize(id);
      return {
        id,
        title,
        route: route && typeof route.id === 'string' ? route.id : null,
        path: route && typeof route.path === 'string' ? route.path : `/${id}`,
      };
    });
  }

  name(): string {
    const manifest = this.documentOfType('manifest');
    const data = manifest && isObject(manifest.manifest) ? manifest.manifest : {};
    return typeof data.name === 'string' ? data.name : 'Wireframe';
  }

  /** The shape the engine renders and validates from. */
  documentMap(): Record<string, unknown> {
    const pages = new Map<string, Doc>();
    const datasets = new Map<string, Doc>();
    for (const document of this.documents) {
      if (document.documentType === 'page') pages.set(String(document.id), document);
      if (document.documentType === 'dataset') datasets.set(String(document.id), document);
    }
    return {
      manifest: this.documentOfType('manifest') ?? null,
      sitemap: this.documentOfType('sitemap') ?? null,
      templates: this.documentOfType('templates') ?? null,
      components: this.documentOfType('components') ?? null,
      pages,
      datasets,
    };
  }

  routeTable(): Record<string, string> {
    const table: Record<string, string> = {};
    for (const route of this.routes()) {
      if (typeof route.id === 'string' && typeof route.page === 'string') table[route.id] = `#${route.page}`;
    }
    return table;
  }
}

export function humanize(id: string): string {
  const words = id.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : id;
}
