import yaml from "js-yaml";
import { ApiError } from "../middleware/error-handler.js";
import { requireProjectAccess } from "./project.js";
import { findDocumentsByProjectId } from "../repositories/document.js";
import type { DocumentRow } from "../repositories/document.js";
import { validateProject, buildProject } from "./engine.js";

interface DocumentMap {
  manifest: object | null;
  sitemap: object | null;
  templates: object | null;
  components: object | null;
  pages: Map<string, object>;
  datasets: Map<string, object>;
}

export function buildDocumentMap(rows: DocumentRow[]): DocumentMap {
  const map: DocumentMap = {
    manifest: null,
    sitemap: null,
    templates: null,
    components: null,
    pages: new Map(),
    datasets: new Map(),
  };

  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = yaml.load(row.content);
    } catch {
      throw new ApiError(
        422,
        `Invalid YAML in ${row.documentType}:${row.documentId}`,
      );
    }

    switch (row.documentType) {
      case "manifest":
        map.manifest = parsed as object;
        break;
      case "sitemap":
        map.sitemap = parsed as object;
        break;
      case "templates":
        map.templates = parsed as object;
        break;
      case "components":
        map.components = parsed as object;
        break;
      case "page":
        map.pages.set(row.documentId, parsed as object);
        break;
      case "dataset":
        map.datasets.set(row.documentId, parsed as object);
        break;
    }
  }

  return map;
}

export async function buildProjectFromDb(
  userId: string,
  projectId: string,
  platform: string = "all",
) {
  await requireProjectAccess(userId, projectId);

  const rows = await findDocumentsByProjectId(projectId);
  if (rows.length === 0) {
    throw new ApiError(422, "Project has no documents to build");
  }

  const documentMap = buildDocumentMap(rows);

  const validation = validateProject(documentMap);
  if (!validation.ok) {
    throw new ApiError(422, "Validation failed: " + JSON.stringify(validation.errors));
  }

  const result = buildProject(documentMap, { platform });
  if (!result.ok) {
    throw new ApiError(422, result.error);
  }

  return {
    pages: result.pages,
    css: result.css,
    js: result.js,
    routeTable: result.routeTable,
    indexHtml: result.indexHtml,
    platformIndexes: result.platformIndexes,
  };
}
