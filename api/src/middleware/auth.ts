import { config } from "../config.js";
import { verifyJwt } from "../services/jwt.js";
import type { JwtPayload } from "../services/jwt.js";
import type { Middleware } from "./types.js";

const requestUsers = new WeakMap<Request, JwtPayload>();

const PUBLIC_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^\/health$/ },
  { method: "POST", pattern: /^\/auth\/sso$/ },
  { method: "GET", pattern: /^\/preview\/[^/]+$/ },
  { method: "POST", pattern: /^\/preview\/[^/]+\/auth$/ },
];

function isPublicRoute(method: string, pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (r) => r.method === method && r.pattern.test(pathname),
  );
}

export const auth: Middleware = (next) => async (req) => {
  const url = new URL(req.url);
  if (isPublicRoute(req.method, url.pathname)) {
    return next(req);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);
  const payload = verifyJwt(token, config.jwtSecret);
  if (!payload) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  requestUsers.set(req, payload);
  return next(req);
};

export function getUser(req: Request): JwtPayload | null {
  return requestUsers.get(req) ?? null;
}
