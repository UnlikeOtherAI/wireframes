import { ssoCallback } from "../controllers/auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

const ssoLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

export function handleAuthRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);
  if (url.pathname === "/auth/sso" && req.method === "POST") {
    const limited = ssoLimiter(req);
    if (limited) return Promise.resolve(limited);
    return ssoCallback(req);
  }
  return null;
}
