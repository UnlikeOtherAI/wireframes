import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import { buildProjectFromDb } from "../services/build.js";

const VALID_PLATFORMS = new Set(["web", "mobile", "tablet", "all"]);

export async function buildProjectController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") ?? "all";
  if (!VALID_PLATFORMS.has(platform)) {
    throw new ApiError(400, `Invalid platform "${platform}". Must be one of: web, mobile, tablet, all`);
  }

  const result = await buildProjectFromDb(user.userId, projectId, platform);
  return Response.json(result);
}
