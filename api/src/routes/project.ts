import {
  listProjectsController,
  createProjectController,
  getProjectController,
  updateProjectController,
  deleteProjectController,
} from "../controllers/project.js";

const PROJECT_ID_PATTERN = /^\/projects\/([0-9a-f-]{36})$/;

export function handleProjectRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);

  if (url.pathname === "/projects") {
    if (req.method === "GET") return listProjectsController(req);
    if (req.method === "POST") return createProjectController(req);
    return null;
  }

  const match = PROJECT_ID_PATTERN.exec(url.pathname);
  if (match) {
    const projectId = match[1];
    if (req.method === "GET") return getProjectController(req, projectId);
    if (req.method === "PATCH") return updateProjectController(req, projectId);
    if (req.method === "DELETE")
      return deleteProjectController(req, projectId);
    return null;
  }

  return null;
}
