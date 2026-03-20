import {
  getProfileController,
  updateProfileController,
  deleteAccountController,
  listInvitesController,
  declineInviteController,
} from "../controllers/user-profile.js";

const INVITES_DECLINE_PATTERN =
  /^\/users\/me\/invites\/([0-9a-f-]{36})\/decline$/;

export function handleUserProfileRoute(
  req: Request,
): Promise<Response> | null {
  const url = new URL(req.url);

  if (url.pathname === "/users/me") {
    if (req.method === "GET") return getProfileController(req);
    if (req.method === "PATCH") return updateProfileController(req);
    if (req.method === "DELETE") return deleteAccountController(req);
    return null;
  }

  if (url.pathname === "/users/me/invites") {
    if (req.method === "GET") return listInvitesController(req);
    return null;
  }

  const declineMatch = INVITES_DECLINE_PATTERN.exec(url.pathname);
  if (declineMatch) {
    const inviteId = declineMatch[1];
    if (req.method === "POST")
      return declineInviteController(req, inviteId);
    return null;
  }

  return null;
}
