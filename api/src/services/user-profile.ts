import { ApiError } from "../middleware/error-handler.js";
import {
  findUserById,
  updateUser,
  deleteUserCascade,
  findPendingInvitesByEmail,
  findInviteById,
  deleteInvite,
} from "../repositories/user-profile.js";
import type { UserProfile, PendingInvite } from "../repositories/user-profile.js";

export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
}

export async function updateProfile(
  userId: string,
  data: { displayName?: string; locale?: string },
): Promise<UserProfile> {
  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return updateUser(userId, data);
}

export async function deleteAccount(
  userId: string,
  userEmail: string,
  confirmEmail: string | null,
): Promise<void> {
  if (!confirmEmail || confirmEmail !== userEmail) {
    throw new ApiError(
      400,
      "Missing or invalid X-Confirm-Delete header",
    );
  }
  await deleteUserCascade(userId);
}

export async function listPendingInvites(
  userEmail: string,
): Promise<PendingInvite[]> {
  return findPendingInvitesByEmail(userEmail);
}

export async function declineInvite(
  inviteId: string,
  userEmail: string,
): Promise<void> {
  const invite = await findInviteById(inviteId);
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new ApiError(403, "This invite belongs to a different user");
  }

  await deleteInvite(inviteId);
}
