import { eq, asc, and } from "drizzle-orm";
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
    .where(eq(documents.projectId, projectId))
    .orderBy(asc(documents.documentType), asc(documents.documentId));
}

export async function upsertDocument(
  projectId: string,
  documentType: string,
  documentId: string,
  content: string,
  contentHash: string,
  expectedHash?: string,
): Promise<{ conflict: boolean }> {
  if (expectedHash) {
    const existing = await db
      .select({ contentHash: documents.contentHash })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, projectId),
          eq(documents.documentType, documentType),
          eq(documents.documentId, documentId),
        ),
      )
      .limit(1);

    if (existing[0] && existing[0].contentHash !== expectedHash) {
      return { conflict: true };
    }
  }

  await db
    .insert(documents)
    .values({ projectId, documentType, documentId, content, contentHash })
    .onConflictDoUpdate({
      target: [documents.projectId, documents.documentType, documents.documentId],
      set: { content, contentHash, updatedAt: new Date() },
    });

  return { conflict: false };
}
