// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
import { createComponentRegistryResolver } from '../../engine/component-registry/core.js';

type Document = Record<string, unknown>;
type Definitions = Record<string, unknown>;
export type ComponentModuleRegistry = { namespace: string; componentIds: string[]; components: Definitions };
type Registry = { components: Definitions; sources: Record<string, unknown> };
type Result = { ok: boolean; error?: string; registry: Registry };

const object = (value: unknown): value is Document =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function sourceSize(value: unknown, ancestors = new Set<object>(), depth = 0): number {
  if (depth > 64) throw new Error('Component source is too deeply nested');
  if (!value || typeof value !== 'object') return 1;
  if (ancestors.has(value)) throw new Error('Component source contains recursive YAML aliases');
  ancestors.add(value);
  let size = 1;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe component source property');
    size += sourceSize(child, ancestors, depth + 1);
    if (size > 100_000) throw new Error('Component source is too large');
  }
  ancestors.delete(value);
  return size;
}

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
  componentRegistriesByFile: Map<string, ComponentModuleRegistry>;
} {
  const sizes = new Map<string, number>();
  let sourceTotal = 0;
  for (const [path, document] of documents) {
    const size = sourceSize(document);
    sizes.set(path, size);
    sourceTotal += size;
    if (sourceTotal > 100_000) throw new Error('Component source is too large');
    if (document.imports !== undefined && !object(document.imports)) {
      throw new Error(`Component imports must be an alias map: ${path}`);
    }
  }
  let visits = 0;
  let copiedSize = 0;
  const maxVisits = Math.max(128, documents.size * 16);
  const resolver = createComponentRegistryResolver({
    loadDocument: (path: string) => {
      if (++visits > maxVisits) throw new Error('Component import expansion is too large');
      const document = documents.get(path);
      if (!document) throw new Error(`Imported components file does not exist: ${path}`);
      copiedSize += sizes.get(path) ?? 0;
      if (copiedSize > 200_000) throw new Error('Component import expansion is too large');
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
  const modules = [...documents].filter(([, doc]) => doc.documentType === 'components');
  const rootCandidates = modules.filter(([path]) => !/^components\//iu.test(path));
  const rootEntry = modules.find(([path]) => path === 'components.yaml')
    ?? (rootCandidates.length === 1 ? rootCandidates[0] : modules.length === 1 ? modules[0] : undefined);
  const root = rootEntry?.[1];
  if (rootEntry) merge(project, resolver.loadComponentsDocumentRegistry(rootEntry[0], ''));
  const templates = [...documents].find(([, doc]) => doc.documentType === 'templates');
  const shared = resolver.createEmptyRegistry();
  merge(shared, { ok: true, registry: project });
  if (templates) merge(shared, resolver.loadImportedComponentRegistry(...templates));
  const componentRegistriesByFile = new Map<string, ComponentModuleRegistry>();
  let namespace = 'nessie_preview';
  const sharedIds = Object.keys(shared.components);
  let registryEntries = 0;
  const copyShared = (registry: Registry) => {
    registryEntries += sharedIds.length;
    if (registryEntries > 200_000) throw new Error('Component registries are too large');
    merge(registry, { ok: true, registry: shared });
  };
  while (sharedIds.some(id => id === namespace || id.startsWith(`${namespace}.`))) namespace += '_preview';
  for (const [path, document] of modules) {
    const registry = resolver.createEmptyRegistry();
    copyShared(registry);
    merge(registry, resolver.loadComponentsDocumentRegistry(path, namespace));
    const componentIds = Object.keys(object(document.components) ? document.components : {})
      .map(id => `${namespace}.${id}`);
    if (componentIds.some(id => !Object.hasOwn(registry.components, id))) {
      throw new Error(`Component definitions need an object root: ${path}`);
    }
    componentRegistriesByFile.set(path, { namespace, componentIds, components: registry.components });
  }
  const componentRegistriesByPage = new Map<string, Definitions>();
  for (const [path, document] of documents) {
    if (document.documentType !== 'page' || typeof document.id !== 'string') continue;
    const registry = resolver.createEmptyRegistry();
    copyShared(registry);
    merge(registry, resolver.loadImportedComponentRegistry(path, document));
    componentRegistriesByPage.set(document.id.trim(), registry.components);
  }
  return { components: root ? { ...root, components: project.components } : null,
    componentRegistriesByPage, componentRegistriesByFile };
}
