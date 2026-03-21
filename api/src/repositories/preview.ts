import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { previews, previewAccess } from "../db/schema.js";

export type AccessMode = "public" | "password" | "sso";

export interface PreviewRow {
  id: string;
  projectId: string;
  slug: string;
  accessMode: AccessMode;
  passwordHash: string | null;
  buildUrl: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function findPreviewByProjectId(
  projectId: string,
): Promise<PreviewRow | null> {
  const rows = await db
    .select()
    .from(previews)
    .where(eq(previews.projectId, projectId))
    .limit(1);
  return (rows[0] as PreviewRow) ?? null;
}

export async function findPreviewBySlug(
  slug: string,
): Promise<PreviewRow | null> {
  const rows = await db
    .select()
    .from(previews)
    .where(eq(previews.slug, slug))
    .limit(1);
  return (rows[0] as PreviewRow) ?? null;
}

export async function createPreview(data: {
  projectId: string;
  slug: string;
  accessMode: AccessMode;
  buildUrl: string;
  publishedAt?: Date | null;
}): Promise<PreviewRow> {
  const [row] = await db.insert(previews).values(data).returning();
  return row as PreviewRow;
}

export async function updatePreviewBuild(
  projectId: string,
  data: { buildUrl: string; publishedAt: Date },
): Promise<PreviewRow> {
  const [row] = await db
    .update(previews)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(previews.projectId, projectId))
    .returning();
  return row as PreviewRow;
}

export async function updatePreviewAccess(
  projectId: string,
  data: {
    accessMode?: AccessMode;
    passwordHash?: string | null;
  },
): Promise<PreviewRow> {
  const [row] = await db
    .update(previews)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(previews.projectId, projectId))
    .returning();
  return row as PreviewRow;
}

export async function findPreviewAccessEmails(
  previewId: string,
): Promise<string[]> {
  const rows = await db
    .select({ email: previewAccess.email })
    .from(previewAccess)
    .where(eq(previewAccess.previewId, previewId));
  return rows.map((r) => r.email);
}

export async function replacePreviewAccessEmails(
  previewId: string,
  emails: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(previewAccess)
      .where(eq(previewAccess.previewId, previewId));
    if (emails.length > 0) {
      await tx
        .insert(previewAccess)
        .values(emails.map((email) => ({ previewId, email })));
    }
  });
}

export async function clearPreviewAccessEmails(
  previewId: string,
): Promise<void> {
  await db
    .delete(previewAccess)
    .where(eq(previewAccess.previewId, previewId));
}
