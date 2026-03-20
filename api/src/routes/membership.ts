import {
  listMembersController,
  sendInviteController,
  acceptInviteController,
  changeMemberRoleController,
  removeMemberController,
} from "../controllers/membership.js";

const MEMBERS_PATTERN = /^\/projects\/([0-9a-f-]{36})\/members$/;
const MEMBER_PATTERN = /^\/projects\/([0-9a-f-]{36})\/members\/([0-9a-f-]{36})$/;
const INVITE_PATTERN = /^\/projects\/([0-9a-f-]{36})\/invite$/;
const ACCEPT_PATTERN = /^\/invites\/([0-9a-f]{64})\/accept$/;

export function handleMembershipRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);

  const membersMatch = MEMBERS_PATTERN.exec(url.pathname);
  if (membersMatch) {
    const projectId = membersMatch[1];
    if (req.method === "GET") return listMembersController(req, projectId);
    return null;
  }

  const memberMatch = MEMBER_PATTERN.exec(url.pathname);
  if (memberMatch) {
    const projectId = memberMatch[1];
    const targetUserId = memberMatch[2];
    if (req.method === "PATCH")
      return changeMemberRoleController(req, projectId, targetUserId);
    if (req.method === "DELETE")
      return removeMemberController(req, projectId, targetUserId);
    return null;
  }

  const inviteMatch = INVITE_PATTERN.exec(url.pathname);
  if (inviteMatch) {
    const projectId = inviteMatch[1];
    if (req.method === "POST") return sendInviteController(req, projectId);
    return null;
  }

  const acceptMatch = ACCEPT_PATTERN.exec(url.pathname);
  if (acceptMatch) {
    const token = acceptMatch[1];
    if (req.method === "POST") return acceptInviteController(req, token);
    return null;
  }

  return null;
}
