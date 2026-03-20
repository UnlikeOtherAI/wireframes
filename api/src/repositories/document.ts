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

export interface DocumentListRow {
  id: string;
  documentType: string;
  documentId: string;
  contentHash: string;
  updatedAt: Date;
}

export interface DocumentDetailRow extends DocumentListRow {
  content: string;
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

export async function listDocuments(
  projectId: string,
): Promise<DocumentListRow[]> {
  return db
    .select({
      id: documents.id,
      documentType: documents.documentType,
      documentId: documents.documentId,
      contentHash: documents.contentHash,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(asc(documents.documentType), asc(documents.documentId));
}

export async function findDocument(
  projectId: string,
  documentType: string,
  documentId: string,
): Promise<DocumentDetailRow | null> {
  const rows = await db
    .select({
      id: documents.id,
      documentType: documents.documentType,
      documentId: documents.documentId,
      content: documents.content,
      contentHash: documents.contentHash,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.documentType, documentType),
        eq(documents.documentId, documentId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
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

export async function deleteDocument(
  projectId: string,
  documentType: string,
  documentId: string,
): Promise<boolean> {
  const result = await db
    .delete(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.documentType, documentType),
        eq(documents.documentId, documentId),
      ),
    )
    .returning({ id: documents.id });
  return result.length > 0;
}
