import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { documents } from "../db/schema.js";

export interface DocumentRow {
  id: string;
  projectId: string;
  documentType: string;
  documentId: string;
  content: string;
  contentHash: string;
}

export async function findDocumentsByProjectId(
  projectId: string,
): Promise<DocumentRow[]> {
  return db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      documentType: documents.documentType,
      documentId: documents.documentId,
      content: documents.content,
      contentHash: documents.contentHash,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId));
}
