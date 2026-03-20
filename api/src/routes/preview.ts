import { createRateLimiter } from "../middleware/rate-limit.js";

const previewAuthLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});

const PREVIEW_AUTH_PATTERN = /^\/preview\/([^/]+)\/auth$/;

export function handlePreviewRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);
  const match = PREVIEW_AUTH_PATTERN.exec(url.pathname);

  if (match && req.method === "POST") {
    const limited = previewAuthLimiter(req);
    if (limited) return Promise.resolve(limited);

    // Stub: preview auth endpoint — full implementation in a future task
    return Promise.resolve(
      Response.json({ error: "Not Implemented" }, { status: 501 }),
    );
  }

  return null;
}
