import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, memberships, documents } from "../db/schema.js";

export type MembershipRole = "owner" | "editor" | "viewer";

export interface ProjectWithRole {
  id: string;
  name: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDetail {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function findProjectsByUserId(
  userId: string,
): Promise<ProjectWithRole[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      role: memberships.role,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(memberships)
    .innerJoin(projects, eq(memberships.projectId, projects.id))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(projects.updatedAt));
  return rows as ProjectWithRole[];
}

export async function findProjectById(
  projectId: string,
): Promise<ProjectDetail | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

export async function findMembership(
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

export async function countMembers(projectId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(memberships)
    .where(eq(memberships.projectId, projectId));
  return rows[0].value;
}

export async function countDocuments(projectId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(documents)
    .where(eq(documents.projectId, projectId));
  return rows[0].value;
}

export async function createProjectWithOwner(
  name: string,
  userId: string,
): Promise<ProjectDetail> {
  return await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ name, ownerId: userId })
      .returning();

    await tx.insert(memberships).values({
      userId,
      projectId: project.id,
      role: "owner",
    });

    return project;
  });
}

export async function updateProject(
  projectId: string,
  data: { name?: string },
): Promise<ProjectDetail> {
  const [updated] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return updated;
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, projectId));
}
