import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import {
  getDocumentList,
  getDocument,
  upsertDocumentContent,
  removeDocument,
} from "../services/document.js";

function requireUser(req: Request) {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

export async function listDocumentsController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);
  const docs = await getDocumentList(user.userId, projectId);
  return Response.json(docs);
}

export async function getDocumentController(
  req: Request,
  projectId: string,
  documentType: string,
  documentId: string,
): Promise<Response> {
  const user = requireUser(req);
  const doc = await getDocument(user.userId, projectId, documentType, documentId);
  return Response.json(doc);
}

export async function upsertDocumentController(
  req: Request,
  projectId: string,
  documentType: string,
): Promise<Response> {
  const user = requireUser(req);

  let body: { documentId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.documentId || typeof body.documentId !== "string" || !body.documentId.trim()) {
    throw new ApiError(400, "Missing or invalid documentId");
  }

  if (!body.content || typeof body.content !== "string") {
    throw new ApiError(400, "Missing or invalid content");
  }

  const ifMatch = req.headers.get("If-Match") ?? undefined;

  const saved = await upsertDocumentContent(
    user.userId,
    projectId,
    documentType,
    body.documentId.trim(),
    body.content,
    ifMatch,
  );

  return Response.json(saved);
}

export async function deleteDocumentController(
  req: Request,
  projectId: string,
  documentType: string,
  documentId: string,
): Promise<Response> {
  const user = requireUser(req);
  await removeDocument(user.userId, projectId, documentType, documentId);
  return new Response(null, { status: 204 });
}
