import { upsertBySsoSubject } from "../repositories/user.js";
import type { SsoUserInfo } from "./sso.js";

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  locale: string;
}

export async function findOrCreateUser(info: SsoUserInfo): Promise<AuthUser> {
  const user = await upsertBySsoSubject({
    ssoSubject: info.ssoSubject,
    email: info.email,
    displayName: info.displayName,
  });
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName ?? "",
    locale: user.locale ?? "en",
  };
}
