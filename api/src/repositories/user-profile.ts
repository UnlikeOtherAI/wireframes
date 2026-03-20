import { eq, and, isNull, sql, asc, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users,
  memberships,
  invites,
  projects,
} from "../db/schema.js";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  locale: string | null;
  createdAt: Date;
}

export interface PendingInvite {
  id: string;
  projectId: string;
  projectName: string;
  role: string;
  invitedBy: string;
  createdAt: Date;
  token: string;
}

export async function findUserById(
  userId: string,
): Promise<UserProfile | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      locale: users.locale,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateUser(
  userId: string,
  data: { displayName?: string; locale?: string },
): Promise<UserProfile> {
  const [updated] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      locale: users.locale,
      createdAt: users.createdAt,
    });
  return updated;
}

export async function findOwnedProjectIds(
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ projectId: memberships.projectId })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.role, "owner")),
    );
  return rows.map((r) => r.projectId);
}

export async function findOldestEditorForProject(
  projectId: string,
  excludeUserId: string,
): Promise<{ userId: string } | null> {
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        eq(memberships.projectId, projectId),
        eq(memberships.role, "editor"),
        sql`${memberships.userId} != ${excludeUserId}`,
      ),
    )
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteUserCascade(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const ownedProjects = await tx
      .select({ projectId: memberships.projectId })
      .from(memberships)
      .where(
        and(eq(memberships.userId, userId), eq(memberships.role, "owner")),
      );

    for (const { projectId } of ownedProjects) {
      const editors = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.projectId, projectId),
            eq(memberships.role, "editor"),
            sql`${memberships.userId} != ${userId}`,
          ),
        )
        .orderBy(asc(memberships.createdAt))
        .limit(1);

      if (editors.length > 0) {
        const newOwner = editors[0].userId;
        await tx
          .update(memberships)
          .set({ role: "owner" })
          .where(
            and(
              eq(memberships.userId, newOwner),
              eq(memberships.projectId, projectId),
            ),
          );
        await tx
          .update(projects)
          .set({ ownerId: newOwner })
          .where(eq(projects.id, projectId));
      } else {
        await tx.delete(projects).where(eq(projects.id, projectId));
      }
    }

    await tx
      .delete(invites)
      .where(eq(invites.invitedBy, userId));

    await tx.delete(users).where(eq(users.id, userId));
  });
}

export async function findPendingInvitesByEmail(
  email: string,
): Promise<PendingInvite[]> {
  const rows = await db
    .select({
      id: invites.id,
      projectId: invites.projectId,
      projectName: projects.name,
      role: invites.role,
      invitedBy: invites.invitedBy,
      createdAt: invites.createdAt,
      token: invites.token,
    })
    .from(invites)
    .innerJoin(projects, eq(invites.projectId, projects.id))
    .where(
      and(
        sql`lower(${invites.email}) = lower(${email})`,
        isNull(invites.acceptedAt),
      ),
    )
    .orderBy(desc(invites.createdAt));
  return rows;
}

export async function findInviteById(
  inviteId: string,
): Promise<{ id: string; email: string } | null> {
  const rows = await db
    .select({ id: invites.id, email: invites.email })
    .from(invites)
    .where(and(eq(invites.id, inviteId), isNull(invites.acceptedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteInvite(inviteId: string): Promise<void> {
  await db.delete(invites).where(eq(invites.id, inviteId));
}
