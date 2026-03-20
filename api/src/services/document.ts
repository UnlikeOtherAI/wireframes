import yaml from "js-yaml";
import { ApiError } from "../middleware/error-handler.js";
import { requireProjectAccess } from "./project.js";
import {
  listDocuments as repoListDocuments,
  findDocument as repoFindDocument,
  upsertDocument as repoUpsertDocument,
  deleteDocument as repoDeleteDocument,
} from "../repositories/document.js";
import { validateDocument, SchemaLoadError } from "./engine.js";

const VALID_DOCUMENT_TYPES = new Set([
  "manifest",
  "sitemap",
  "templates",
  "components",
  "page",
  "dataset",
]);

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getDocumentList(userId: string, projectId: string) {
  await requireProjectAccess(userId, projectId);
  return repoListDocuments(projectId);
}

export async function getDocument(
  userId: string,
  projectId: string,
  documentType: string,
  documentId: string,
) {
  await requireProjectAccess(userId, projectId);

  const doc = await repoFindDocument(projectId, documentType, documentId);
  if (!doc) {
    throw new ApiError(404, "Document not found");
  }
  return doc;
}

export async function upsertDocumentContent(
  userId: string,
  projectId: string,
  documentType: string,
  documentId: string,
  content: string,
  ifMatch?: string,
) {
  await requireProjectAccess(userId, projectId, "editor");

  if (!VALID_DOCUMENT_TYPES.has(documentType)) {
    throw new ApiError(422, `Unknown document type: ${documentType}`, [
      { path: "documentType", message: `Unsupported document type "${documentType}"` },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Malformed YAML";
    throw new ApiError(422, "Malformed YAML", [
      { path: "content", message },
    ]);
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(422, "YAML must be an object", [
      { path: "content", message: "Expected a YAML mapping, not a scalar or sequence" },
    ]);
  }

  const label = `${documentType}:${documentId}`;
  try {
    const result = validateDocument(parsed, label);

    if (result.id !== documentId) {
      throw new ApiError(422, "Document id mismatch", [
        { path: "id", message: `YAML id "${result.id}" must match documentId "${documentId}"` },
      ]);
    }

    if (result.documentType !== documentType) {
      throw new ApiError(422, "Document type mismatch", [
        { path: "documentType", message: `YAML documentType "${result.documentType}" must match URL documentType "${documentType}"` },
      ]);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.constructor.name === "SchemaLoadError") {
      const schemaErr = err as Error & {
        code?: string;
        details?: { errors?: Array<{ code?: string; path?: string; message: string }> };
      };
      const details = schemaErr.details?.errors?.map((e) => ({
        path: e.path ?? "",
        message: e.message,
      })) ?? [{ path: "", message: schemaErr.message }];
      throw new ApiError(422, "Schema validation failed", details);
    }
    throw err;
  }

  const contentHash = await computeHash(content);

  const { conflict } = await repoUpsertDocument(
    projectId,
    documentType,
    documentId,
    content,
    contentHash,
    ifMatch,
  );

  if (conflict) {
    throw new ApiError(409, "Content has been modified (hash mismatch)");
  }

  const saved = await repoFindDocument(projectId, documentType, documentId);
  return saved!;
}

export async function removeDocument(
  userId: string,
  projectId: string,
  documentType: string,
  documentId: string,
) {
  await requireProjectAccess(userId, projectId, "editor");

  const deleted = await repoDeleteDocument(projectId, documentType, documentId);
  if (!deleted) {
    throw new ApiError(404, "Document not found");
  }
}
