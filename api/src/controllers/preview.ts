import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import {
  publishPreview,
  getPreviewSettings,
  updatePreviewSettings,
} from "../services/preview.js";

export async function publishPreviewController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  const result = await publishPreview(user.userId, projectId);
  return Response.json(result);
}

export async function getPreviewController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  const result = await getPreviewSettings(user.userId, projectId);
  if (!result) {
    return Response.json({ error: "No preview found" }, { status: 404 });
  }
  return Response.json(result);
}

export async function updatePreviewController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  const body = await req.json();
  const result = await updatePreviewSettings(user.userId, projectId, body);
  return Response.json(result);
}
