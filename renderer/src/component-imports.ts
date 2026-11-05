// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
import { createComponentRegistryResolver } from '../../engine/component-registry/core.js';

type Document = Record<string, unknown>;
type Definitions = Record<string, unknown>;
type Registry = { components: Definitions; sources: Record<string, unknown> };
type Result = { ok: boolean; error?: string; registry: Registry };

const object = (value: unknown): value is Document =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Import paths are relative to their source document and stay inside the virtual project. */
export function normalizeVirtualImport(source: string, imported: string): string {
  if (!imported || imported.startsWith('/') || /[\\\u0000:?#]/u.test(imported)) {
    throw new Error(`Component import must be a relative project path: ${imported}`);
  }
  const parts = source.split('/').slice(0, -1);
  for (const part of imported.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (!parts.length) throw new Error(`Component import escapes the project: ${imported}`);
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

/** The filesystem and virtual adapters share traversal, qualification, conflicts and cycles. */
export function resolveVirtualComponentImports(documents: Map<string, Document>): {
  components: Document | null;
  componentRegistriesByPage: Map<string, Definitions>;
} {
  for (const [path, document] of documents) {
    if (document.imports !== undefined && !object(document.imports)) {
      throw new Error(`Component imports must be an alias map: ${path}`);
    }
  }
  let visits = 0;
  const maxVisits = Math.max(128, documents.size * 16);
  const resolver = createComponentRegistryResolver({
    loadDocument: (path: string) => {
      if (++visits > maxVisits) throw new Error('Component import expansion is too large');
      const document = documents.get(path);
      if (!document) throw new Error(`Imported components file does not exist: ${path}`);
      if (document.imports !== undefined && !object(document.imports)) {
        throw new Error(`Component imports must be an alias map: ${path}`);
      }
      return { document, documentType: document.documentType };
    },
    resolveImportPath: normalizeVirtualImport,
  }) as {
    createEmptyRegistry: () => Registry;
    mergeComponentRegistry: (target: Registry, source: Registry) => { ok: boolean; error?: string };
    loadComponentsDocumentRegistry: (path: string, namespace: string) => Result;
    loadImportedComponentRegistry: (path: string, document: Document) => Result;
  };
  const merge = (target: Registry, result: Result) => {
    if (!result.ok) throw new Error(result.error || 'Unable to resolve component imports');
    const merged = resolver.mergeComponentRegistry(target, result.registry);
    if (!merged.ok) throw new Error(merged.error);
  };
  const project = resolver.createEmptyRegistry();
  const root = documents.get('components.yaml');
  if (root) merge(project, resolver.loadComponentsDocumentRegistry('components.yaml', ''));
  const templates = [...documents].find(([, doc]) => doc.documentType === 'templates');
  const componentRegistriesByPage = new Map<string, Definitions>();
  for (const [path, document] of documents) {
    if (document.documentType !== 'page' || typeof document.id !== 'string') continue;
    const registry = resolver.createEmptyRegistry();
    const copied = resolver.mergeComponentRegistry(registry, project);
    if (!copied.ok) throw new Error(copied.error);
    if (templates) merge(registry, resolver.loadImportedComponentRegistry(...templates));
    merge(registry, resolver.loadImportedComponentRegistry(path, document));
    componentRegistriesByPage.set(document.id.trim(), registry.components);
  }
  return { components: root ? { ...root, components: project.components } : null, componentRegistriesByPage };
}
