import { ApiError } from "../middleware/error-handler.js";
import { config } from "../config.js";
import { validateSsoToken } from "../services/sso.js";
import { findOrCreateUser } from "../services/user.js";
import { loginAsDevUser } from "../services/dev-auth.js";
import { signJwt } from "../services/jwt.js";

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
  const jwt = signJwt(
    { userId: user.userId, email: user.email },
    config.jwtSecret,
  );

  return Response.json({ token: jwt, user: toResponseUser(user) });
}

export async function devLogin(req: Request): Promise<Response> {
  if (!config.devAuthEnabled) {
    throw new ApiError(404, "Not Found");
  }

  if (!isLocalRequest(req)) {
    throw new ApiError(403, "Dev login is only available on localhost");
  }

  const user = await loginAsDevUser();
  const jwt = signJwt(
    { userId: user.userId, email: user.email },
    config.jwtSecret,
  );

  return Response.json({ token: jwt, user: toResponseUser(user) });
}
