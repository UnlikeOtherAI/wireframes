import { buildProjectController } from "../controllers/build.js";

const BUILD_PATTERN = /^\/projects\/([0-9a-f-]{36})\/build$/;

export function handleBuildRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);
  const match = BUILD_PATTERN.exec(url.pathname);
  if (!match) return null;

  if (req.method === "POST") {
    return buildProjectController(req, match[1]);
  }

  return null;
}
