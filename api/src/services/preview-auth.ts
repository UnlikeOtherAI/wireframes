import { createHmac } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "../middleware/error-handler.js";
import { downloadFile } from "./gcs.js";
import { validateSsoToken } from "./sso.js";
import {
  findPreviewBySlug,
  findPreviewAccessEmails,
} from "../repositories/preview.js";

const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

export interface PreviewJwtPayload {
  previewId: string;
  accessGranted: boolean;
}

interface PreviewJwtFull extends PreviewJwtPayload {
  iat: number;
  exp: number;
}

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

export function signPreviewJwt(previewId: string, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({
      previewId,
      accessGranted: true,
      iat: now,
      exp: now + TWENTY_FOUR_HOURS_SECONDS,
    }),
  );
  const signature = hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyPreviewJwt(
  token: string,
  secret: string,
): PreviewJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSignature = hmacSign(`${header}.${body}`, secret);
  if (signature !== expectedSignature) return null;

  let payload: PreviewJwtFull;
  try {
    payload = JSON.parse(base64urlDecode(body));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;
  if (!payload.previewId || !payload.accessGranted) return null;

  return { previewId: payload.previewId, accessGranted: payload.accessGranted };
}

function extractPreviewCookie(
  cookieHeader: string | null,
  slug: string,
): string | null {
  if (!cookieHeader) return null;
  const cookieName = `preview_session_${slug}`;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name.trim() === cookieName) {
      return rest.join("=").trim();
    }
  }
  return null;
}

export interface ViewPreviewResult {
  allowed: boolean;
  requiresAuth?: "password" | "sso";
  ssoUrl?: string;
  buffer?: Buffer;
  contentType?: string;
}

export async function viewPreview(
  slug: string,
  subPath: string,
  cookieHeader: string | null,
): Promise<ViewPreviewResult> {
  const preview = await findPreviewBySlug(slug);
  if (!preview) {
    throw new ApiError(404, "Preview not found");
  }

  if (!preview.publishedAt) {
    throw new ApiError(404, "Preview not found");
  }

  if (preview.accessMode !== "public") {
    const token = extractPreviewCookie(cookieHeader, slug);
    let authorized = false;

    if (token) {
      const payload = verifyPreviewJwt(token, config.jwtSecret);
      if (payload && payload.previewId === preview.id && payload.accessGranted) {
        authorized = true;
      }
    }

    if (!authorized) {
      if (preview.accessMode === "password") {
        return { allowed: false, requiresAuth: "password" };
      }
      if (preview.accessMode === "sso") {
        return {
          allowed: false,
          requiresAuth: "sso",
          ssoUrl: config.ssoVerifyUrl,
        };
      }
    }
  }

  if (subPath.includes("..") || subPath.startsWith("/")) {
    throw new ApiError(400, "Invalid path");
  }

  const gcsPath = `previews/${slug}/${subPath}`;
  const file = await downloadFile(gcsPath);

  return {
    allowed: true,
    buffer: file.buffer,
    contentType: file.contentType,
  };
}

export async function authenticatePreview(
  slug: string,
  body: { password?: string; ssoToken?: string },
): Promise<{ token: string; slug: string }> {
  const preview = await findPreviewBySlug(slug);
  if (!preview) {
    throw new ApiError(404, "Preview not found");
  }

  if (preview.accessMode === "password") {
    if (!body.password) {
      throw new ApiError(400, "Password is required");
    }

    const valid = await Bun.password.verify(
      body.password,
      preview.passwordHash || "",
    );
    if (!valid) {
      throw new ApiError(401, "Invalid password");
    }

    const token = signPreviewJwt(preview.id, config.jwtSecret);
    return { token, slug };
  }

  if (preview.accessMode === "sso") {
    if (!body.ssoToken) {
      throw new ApiError(400, "SSO token is required");
    }

    const ssoUser = await validateSsoToken(body.ssoToken);
    if (!ssoUser) {
      throw new ApiError(401, "Invalid SSO token");
    }

    const allowedEmails = await findPreviewAccessEmails(preview.id);
    const emailLower = ssoUser.email.toLowerCase();
    const isAllowed = allowedEmails.some(
      (e) => e.toLowerCase() === emailLower,
    );

    if (!isAllowed) {
      throw new ApiError(403, "Email not in access list");
    }

    const token = signPreviewJwt(preview.id, config.jwtSecret);
    return { token, slug };
  }

  throw new ApiError(400, "Preview does not require authentication");
}

export function buildPreviewCookie(
  token: string,
  slug: string,
): string {
  const maxAge = TWENTY_FOUR_HOURS_SECONDS;
  return `preview_session_${slug}=${token}; Path=/preview/${slug}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
