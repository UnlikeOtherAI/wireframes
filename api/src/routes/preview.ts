import { createRateLimiter } from "../middleware/rate-limit.js";
import {
  publishPreviewController,
  getPreviewController,
  updatePreviewController,
} from "../controllers/preview.js";
import {
  viewPreviewController,
  authenticatePreviewController,
} from "../controllers/preview-view.js";

const previewAuthLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});

const PREVIEW_AUTH_PATTERN = /^\/preview\/([^/]+)\/auth$/;
const PREVIEW_VIEW_PATTERN = /^\/preview\/([^/]+)(?:\/(.+))?$/;
const PROJECT_PREVIEW_PATTERN = /^\/projects\/([0-9a-f-]{36})\/preview$/;

export function handlePreviewRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);

  const projectMatch = PROJECT_PREVIEW_PATTERN.exec(url.pathname);
  if (projectMatch) {
    const projectId = projectMatch[1];
    if (req.method === "POST") {
      return publishPreviewController(req, projectId);
    }
    if (req.method === "GET") {
      return getPreviewController(req, projectId);
    }
    if (req.method === "PATCH") {
      return updatePreviewController(req, projectId);
    }
    return null;
  }

  const authMatch = PREVIEW_AUTH_PATTERN.exec(url.pathname);
  if (authMatch) {
    if (req.method === "POST") {
      const slug = authMatch[1];
      const limited = previewAuthLimiter(req);
      if (limited) return Promise.resolve(limited);

      return authenticatePreviewController(req, slug);
    }
    return null;
  }

  const viewMatch = PREVIEW_VIEW_PATTERN.exec(url.pathname);
  if (viewMatch && req.method === "GET") {
    const slug = viewMatch[1];
    const subPath = viewMatch[2] || "index.html";
    return viewPreviewController(req, slug, subPath);
  }

  return null;
}
