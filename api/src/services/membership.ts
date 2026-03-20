import { randomBytes } from "node:crypto";
import { ApiError } from "../middleware/error-handler.js";
import { requireProjectAccess } from "./project.js";
import {
  findMembersByProjectId,
  findUserByEmail,
  findMembershipByUserAndProject,
  findPendingInviteByProjectAndEmail,
  createInvite,
  findInviteByToken,
  acceptInvite as acceptInviteRepo,
  updateMemberRole,
  transferOwnership,
  removeMembership,
  findProjectById,
} from "../repositories/membership.js";
import type { MemberWithUser, InviteRole } from "../repositories/membership.js";

export async function listMembers(
  userId: string,
  projectId: string,
): Promise<MemberWithUser[]> {
  await requireProjectAccess(userId, projectId);
  return findMembersByProjectId(projectId);
}

export async function sendInvite(
  userId: string,
  projectId: string,
  email: string,
  role: InviteRole,
) {
  await requireProjectAccess(userId, projectId, "owner");

  const normalizedEmail = email.toLowerCase();

  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    const existingMembership = await findMembershipByUserAndProject(
      existingUser.id,
      projectId,
    );
    if (existingMembership) {
      throw new ApiError(409, "User is already a member of this project");
    }
  }

  const existingInvite = await findPendingInviteByProjectAndEmail(
    projectId,
    normalizedEmail,
  );
  if (existingInvite) {
    throw new ApiError(409, "An invite for this email already exists");
  }

  const token = randomBytes(32).toString("hex");
  const invite = await createInvite({
    projectId,
    email: normalizedEmail,
    role,
    token,
    invitedBy: userId,
  });

  return invite;
}

export async function acceptInviteByToken(
  token: string,
  userId: string,
  userEmail: string,
) {
  const invite = await findInviteByToken(token);
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }

  if (invite.acceptedAt) {
    throw new ApiError(400, "Invite has already been accepted");
  }

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new ApiError(403, "This invite was sent to a different email address");
  }

  const existingMembership = await findMembershipByUserAndProject(
    userId,
    invite.projectId,
  );
  if (existingMembership) {
    throw new ApiError(409, "You are already a member of this project");
  }

  await acceptInviteRepo(invite.id, userId, invite.projectId, invite.role);

  const project = await findProjectById(invite.projectId);
  return project;
}

export async function changeMemberRole(
  userId: string,
  projectId: string,
  targetUserId: string,
  newRole: string,
) {
  await requireProjectAccess(userId, projectId, "owner");

  if (userId === targetUserId) {
    throw new ApiError(400, "Cannot change your own role");
  }

  const targetMembership = await findMembershipByUserAndProject(
    targetUserId,
    projectId,
  );
  if (!targetMembership) {
    throw new ApiError(404, "Member not found");
  }

  if (newRole === "owner") {
    await transferOwnership(projectId, userId, targetUserId);
  } else {
    await updateMemberRole(
      targetUserId,
      projectId,
      newRole as "editor" | "viewer",
    );
  }

  return { userId: targetUserId, role: newRole };
}

export async function removeMember(
  userId: string,
  projectId: string,
  targetUserId: string,
) {
  await requireProjectAccess(userId, projectId, "owner");

  if (userId === targetUserId) {
    throw new ApiError(400, "Cannot remove yourself as owner");
  }

  const targetMembership = await findMembershipByUserAndProject(
    targetUserId,
    projectId,
  );
  if (!targetMembership) {
    throw new ApiError(404, "Member not found");
  }

  await removeMembership(targetUserId, projectId);
}
