import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export interface UpsertUserParams {
  ssoSubject: string;
  email: string;
  displayName: string | null;
}

export async function findBySsoSubject(
  ssoSubject: string,
): Promise<typeof users.$inferSelect | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.ssoSubject, ssoSubject))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertBySsoSubject(
  params: UpsertUserParams,
): Promise<typeof users.$inferSelect> {
  const existing = await findBySsoSubject(params.ssoSubject);
  if (existing) {
    const updated = await db
      .update(users)
      .set({
        email: params.email,
        displayName: params.displayName ?? existing.displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.ssoSubject, params.ssoSubject))
      .returning();
    return updated[0];
  }

  const inserted = await db
    .insert(users)
    .values({
      email: params.email,
      displayName: params.displayName,
      ssoSubject: params.ssoSubject,
    })
    .returning();
  return inserted[0];
}
