import { ApiError } from "../middleware/error-handler.js";
import { config } from "../config.js";
import { validateSsoToken } from "../services/sso.js";
import { findOrCreateUser } from "../services/user.js";
import { signJwt } from "../services/jwt.js";

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

  return Response.json({ token: jwt });
}
