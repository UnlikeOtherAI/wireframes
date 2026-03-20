import { createHmac } from "node:crypto";

export interface JwtPayload {
  userId: string;
  email: string;
}

interface JwtFullPayload extends JwtPayload {
  iat: number;
  exp: number;
  type: string;
}

const ACCESS_TOKEN_TTL = 30 * 60; // 30 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

function base64url(input: string | Buffer): string {
  const str =
    typeof input === "string"
      ? Buffer.from(input).toString("base64")
      : input.toString("base64");
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(input: string): string {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function hmacSign(data: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(data).digest());
}

function sign(
  payload: JwtPayload,
  secret: string,
  ttl: number,
  type: string,
): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({ ...payload, type, iat: now, exp: now + ttl }),
  );
  const signature = hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

function verify(
  token: string,
  secret: string,
  expectedType: string,
): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSignature = hmacSign(`${header}.${body}`, secret);
  if (signature !== expectedSignature) return null;

  let payload: JwtFullPayload;
  try {
    payload = JSON.parse(base64urlDecode(body));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;
  if (!payload.userId || !payload.email) return null;
  if (payload.type !== expectedType) return null;

  return { userId: payload.userId, email: payload.email };
}

export function signJwt(payload: JwtPayload, secret: string): string {
  return sign(payload, secret, ACCESS_TOKEN_TTL, "access");
}

export function signRefreshJwt(payload: JwtPayload, secret: string): string {
  return sign(payload, secret, REFRESH_TOKEN_TTL, "refresh");
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  return verify(token, secret, "access");
}

export function verifyRefreshJwt(
  token: string,
  secret: string,
): JwtPayload | null {
  return verify(token, secret, "refresh");
}
