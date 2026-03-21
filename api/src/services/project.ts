import { ApiError } from "../middleware/error-handler.js";
import {
  findProjectsByUserId,
  findProjectById,
  findMembership,
  countMembers,
  countDocuments,
  createProjectWithOwner,
  updateProject,
  deleteProject,
} from "../repositories/project.js";
import type { MembershipRole, ProjectWithRole } from "../repositories/project.js";

const ROLE_LEVELS: Record<MembershipRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minRole?: MembershipRole,
): Promise<MembershipRole> {
  const membership = await findMembership(userId, projectId);
  if (!membership) {
    throw new ApiError(403, "You do not have access to this project");
  }
  if (minRole && ROLE_LEVELS[membership.role] < ROLE_LEVELS[minRole]) {
    throw new ApiError(403, "Insufficient permissions");
  }
  return membership.role;
}

export async function listProjects(
  userId: string,
): Promise<ProjectWithRole[]> {
  return findProjectsByUserId(userId);
}

export async function createProject(name: string, userId: string) {
  const project = await createProjectWithOwner(name, userId);
  return project;
}

export async function getProjectDetails(userId: string, projectId: string) {
  const role = await requireProjectAccess(userId, projectId);

  const project = await findProjectById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const [memberCount, documentCount] = await Promise.all([
    countMembers(projectId),
    countDocuments(projectId),
  ]);

  return {
    ...project,
    role,
    memberCount,
    documentCount,
  };
}

export async function renameProject(
  userId: string,
  projectId: string,
  name: string,
) {
  const role = await requireProjectAccess(userId, projectId, "editor");
  const updated = await updateProject(projectId, { name });
  return { ...updated, role };
}

export async function removeProject(userId: string, projectId: string) {
  await requireProjectAccess(userId, projectId, "owner");
  await deleteProject(projectId);
}
