import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import {
  listMembers,
  sendInvite,
  acceptInviteByToken,
  changeMemberRole,
  removeMember,
} from "../services/membership.js";

const VALID_INVITE_ROLES = ["editor", "viewer"];
const VALID_MEMBER_ROLES = ["owner", "editor", "viewer"];

function requireUser(req: Request) {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

export async function listMembersController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);
  const members = await listMembers(user.userId, projectId);
  return Response.json(members);
}

export async function sendInviteController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.email || typeof body.email !== "string" || !body.email.trim()) {
    throw new ApiError(400, "Missing or invalid email");
  }

  if (!body.role || !VALID_INVITE_ROLES.includes(body.role)) {
    throw new ApiError(400, "Role must be 'editor' or 'viewer'");
  }

  const invite = await sendInvite(
    user.userId,
    projectId,
    body.email.trim(),
    body.role as "editor" | "viewer",
  );
  return Response.json(invite, { status: 201 });
}

export async function acceptInviteController(
  req: Request,
  token: string,
): Promise<Response> {
  const user = requireUser(req);
  const project = await acceptInviteByToken(token, user.userId, user.email);
  return Response.json(project);
}

export async function changeMemberRoleController(
  req: Request,
  projectId: string,
  targetUserId: string,
): Promise<Response> {
  const user = requireUser(req);

  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.role || !VALID_MEMBER_ROLES.includes(body.role)) {
    throw new ApiError(400, "Role must be 'owner', 'editor', or 'viewer'");
  }

  const result = await changeMemberRole(
    user.userId,
    projectId,
    targetUserId,
    body.role,
  );
  return Response.json(result);
}

export async function removeMemberController(
  req: Request,
  projectId: string,
  targetUserId: string,
): Promise<Response> {
  const user = requireUser(req);
  await removeMember(user.userId, projectId, targetUserId);
  return new Response(null, { status: 204 });
}
