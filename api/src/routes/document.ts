import {
  listDocumentsController,
  getDocumentController,
  upsertDocumentController,
  deleteDocumentController,
} from "../controllers/document.js";

const DOCUMENTS_LIST = /^\/projects\/([0-9a-f-]{36})\/documents$/;
const DOCUMENT_UPSERT = /^\/projects\/([0-9a-f-]{36})\/documents\/([a-z]+)$/;
const DOCUMENT_SINGLE = /^\/projects\/([0-9a-f-]{36})\/documents\/([a-z]+)\/(.+)$/;

export function handleDocumentRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);

  const listMatch = DOCUMENTS_LIST.exec(url.pathname);
  if (listMatch) {
    if (req.method === "GET") return listDocumentsController(req, listMatch[1]);
    return null;
  }

  const singleMatch = DOCUMENT_SINGLE.exec(url.pathname);
  if (singleMatch) {
    const [, projectId, docType, docId] = singleMatch;
    if (req.method === "GET")
      return getDocumentController(req, projectId, docType, docId);
    if (req.method === "DELETE")
      return deleteDocumentController(req, projectId, docType, docId);
    return null;
  }

  const upsertMatch = DOCUMENT_UPSERT.exec(url.pathname);
  if (upsertMatch) {
    if (req.method === "PUT")
      return upsertDocumentController(req, upsertMatch[1], upsertMatch[2]);
    return null;
  }

  return null;
}
