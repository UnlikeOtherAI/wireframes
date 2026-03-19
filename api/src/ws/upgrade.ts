import type { Server } from "bun";
import type { WsData } from "./types.js";

// JWT validation is implemented by the sibling auth task.
// This module provides the upgrade hook structure; the actual JWT
// verification function is injected so this file has no auth logic.

export type JwtPayload = { userId: string; email: string } | null;
export type VerifyJwt = (token: string) => JwtPayload;

let verifyJwt: VerifyJwt = () => null;

export function setJwtVerifier(fn: VerifyJwt): void {
  verifyJwt = fn;
}

export function tryUpgrade(req: Request, server: Server<WsData>): boolean {
  const url = new URL(req.url);
  if (url.pathname !== "/ws") return false;

  const token =
    url.searchParams.get("token") || getCookieValue(req, "session");

  if (!token) {
    return false;
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return false;
  }

  const data: WsData = {
    userId: payload.userId,
    email: payload.email,
    channels: new Set(),
  };

  return server.upgrade(req, { data });
}

function getCookieValue(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.split(";").find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return match.split("=")[1]?.trim() || null;
}
