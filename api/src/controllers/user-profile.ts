import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import {
  getProfile,
  updateProfile,
  deleteAccount,
  listPendingInvites,
  declineInvite,
} from "../services/user-profile.js";

function requireUser(req: Request) {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

export async function getProfileController(
  req: Request,
): Promise<Response> {
  const user = requireUser(req);
  const profile = await getProfile(user.userId);
  return Response.json(profile);
}

export async function updateProfileController(
  req: Request,
): Promise<Response> {
  const user = requireUser(req);

  let body: { displayName?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  const updates: { displayName?: string; locale?: string } = {};

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string") {
      throw new ApiError(400, "Invalid displayName");
    }
    updates.displayName = body.displayName;
  }

  if (body.locale !== undefined) {
    if (typeof body.locale !== "string" || !body.locale.trim()) {
      throw new ApiError(400, "Invalid locale");
    }
    updates.locale = body.locale.trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  const profile = await updateProfile(user.userId, updates);
  return Response.json(profile);
}

export async function deleteAccountController(
  req: Request,
): Promise<Response> {
  const user = requireUser(req);
  const confirmHeader = req.headers.get("X-Confirm-Delete");
  await deleteAccount(user.userId, user.email, confirmHeader);
  return new Response(null, { status: 204 });
}

export async function listInvitesController(
  req: Request,
): Promise<Response> {
  const user = requireUser(req);
  const invites = await listPendingInvites(user.email);
  return Response.json(invites);
}

export async function declineInviteController(
  req: Request,
  inviteId: string,
): Promise<Response> {
  const user = requireUser(req);
  await declineInvite(inviteId, user.email);
  return new Response(null, { status: 204 });
}
