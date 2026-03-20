import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import {
  listProjects,
  createProject,
  getProjectDetails,
  renameProject,
  removeProject,
} from "../services/project.js";

function requireUser(req: Request) {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

export async function listProjectsController(
  req: Request,
): Promise<Response> {
  const user = requireUser(req);
  const projects = await listProjects(user.userId);
  return Response.json(projects);
}

export async function createProjectController(
  req: Request,
): Promise<Response> {
  const user = requireUser(req);

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    throw new ApiError(400, "Missing or invalid project name");
  }

  const project = await createProject(body.name.trim(), user.userId);
  return Response.json(project, { status: 201 });
}

export async function getProjectController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);
  const details = await getProjectDetails(user.userId, projectId);
  return Response.json(details);
}

export async function updateProjectController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new ApiError(400, "Invalid project name");
    }
    body.name = body.name.trim();
  }

  const updated = await renameProject(user.userId, projectId, body.name!);
  return Response.json(updated);
}

export async function deleteProjectController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);
  await removeProject(user.userId, projectId);
  return new Response(null, { status: 204 });
}
