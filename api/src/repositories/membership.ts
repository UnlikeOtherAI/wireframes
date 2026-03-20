import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { memberships, users, invites, projects } from "../db/schema.js";

export type MembershipRole = "owner" | "editor" | "viewer";
export type InviteRole = "editor" | "viewer";

export interface MemberWithUser {
  userId: string;
  email: string;
  displayName: string | null;
  role: MembershipRole;
  joinedAt: Date;
}

export interface InviteRow {
  id: string;
  projectId: string;
  email: string;
  role: InviteRole;
  token: string;
  invitedBy: string;
  acceptedAt: Date | null;
  createdAt: Date;
}

export async function findMembersByProjectId(
  projectId: string,
): Promise<MemberWithUser[]> {
  const rows = await db
    .select({
      userId: memberships.userId,
      email: users.email,
      displayName: users.displayName,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.projectId, projectId));
  return rows as MemberWithUser[];
}

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
}

export async function findMembershipByUserAndProject(
  userId: string,
  projectId: string,
): Promise<{ role: MembershipRole } | null> {
  const rows = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.projectId, projectId)),
    )
    .limit(1);
  return (rows[0] as { role: MembershipRole }) ?? null;
}

export async function findPendingInviteByProjectAndEmail(
  projectId: string,
  email: string,
): Promise<InviteRow | null> {
  const rows = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.projectId, projectId),
        eq(invites.email, email.toLowerCase()),
        isNull(invites.acceptedAt),
      ),
    )
    .limit(1);
  return (rows[0] as InviteRow) ?? null;
}

export async function createInvite(params: {
  projectId: string;
  email: string;
  role: InviteRole;
  token: string;
  invitedBy: string;
}): Promise<InviteRow> {
  const [row] = await db
    .insert(invites)
    .values({
      projectId: params.projectId,
      email: params.email.toLowerCase(),
      role: params.role,
      token: params.token,
      invitedBy: params.invitedBy,
    })
    .returning();
  return row as InviteRow;
}

export async function findInviteByToken(
  token: string,
): Promise<InviteRow | null> {
  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);
  return (rows[0] as InviteRow) ?? null;
}

export async function acceptInvite(
  inviteId: string,
  userId: string,
  projectId: string,
  role: InviteRole,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(invites)
      .set({ acceptedAt: new Date() })
      .where(eq(invites.id, inviteId));

    await tx.insert(memberships).values({
      userId,
      projectId,
      role,
    });
  });
}

export async function updateMemberRole(
  userId: string,
  projectId: string,
  role: MembershipRole,
): Promise<void> {
  await db
    .update(memberships)
    .set({ role })
    .where(
      and(eq(memberships.userId, userId), eq(memberships.projectId, projectId)),
    );
}

export async function transferOwnership(
  projectId: string,
  currentOwnerId: string,
  newOwnerId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ role: "editor" })
      .where(
        and(
          eq(memberships.userId, currentOwnerId),
          eq(memberships.projectId, projectId),
        ),
      );

    await tx
      .update(memberships)
      .set({ role: "owner" })
      .where(
        and(
          eq(memberships.userId, newOwnerId),
          eq(memberships.projectId, projectId),
        ),
      );

    await tx
      .update(projects)
      .set({ ownerId: newOwnerId })
      .where(eq(projects.id, projectId));
  });
}

export async function removeMembership(
  userId: string,
  projectId: string,
): Promise<void> {
  await db
    .delete(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.projectId, projectId)),
    );
}

export async function findProjectById(
  projectId: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}
