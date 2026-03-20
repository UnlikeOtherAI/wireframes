import { ApiError } from "../middleware/error-handler.js";
import { config } from "../config.js";
import { validateSsoToken } from "../services/sso.js";
import { findOrCreateUser } from "../services/user.js";
import { loginAsDevUser } from "../services/dev-auth.js";
import {
  signJwt,
  signRefreshJwt,
  verifyRefreshJwt,
} from "../services/jwt.js";

function toResponseUser(user: {
  userId: string;
  email: string;
  displayName: string;
  locale: string;
}) {
  return {
    id: user.userId,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
  };
}

function isLocalRequest(req: Request): boolean {
  const hostname = new URL(req.url).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function makeTokens(
  userId: string,
  email: string,
): { token: string; refreshToken: string } {
  return {
    token: signJwt({ userId, email }, config.jwtSecret),
    refreshToken: signRefreshJwt({ userId, email }, config.jwtSecret),
  };
}

export async function ssoCallback(req: Request): Promise<Response> {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.token || typeof body.token !== "string") {
    throw new ApiError(400, "Missing or invalid token");
  }

  const ssoUser = await validateSsoToken(body.token);
  if (!ssoUser) {
    throw new ApiError(401, "Invalid SSO token");
  }

  const user = await findOrCreateUser(ssoUser);
  const { token, refreshToken } = makeTokens(user.userId, user.email);

  return Response.json({ token, refreshToken, user: toResponseUser(user) });
}

export async function devLogin(req: Request): Promise<Response> {
  if (!config.devAuthEnabled) {
    throw new ApiError(404, "Not Found");
  }

  if (!isLocalRequest(req)) {
    throw new ApiError(403, "Dev login is only available on localhost");
  }

  const user = await loginAsDevUser();
  const { token, refreshToken } = makeTokens(user.userId, user.email);

  return Response.json({ token, refreshToken, user: toResponseUser(user) });
}

export async function refreshTokenHandler(req: Request): Promise<Response> {
  let body: { refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  if (!body.refreshToken || typeof body.refreshToken !== "string") {
    throw new ApiError(400, "Missing refreshToken");
  }

  const payload = verifyRefreshJwt(body.refreshToken, config.jwtSecret);
  if (!payload) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const { token, refreshToken } = makeTokens(payload.userId, payload.email);
  return Response.json({ token, refreshToken });
}
