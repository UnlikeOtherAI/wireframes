import { config } from "../config.js";

export interface SsoUserInfo {
  ssoSubject: string;
  email: string;
  displayName: string | null;
}

export async function validateSsoToken(
  token: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<SsoUserInfo | null> {
  try {
    const res = await fetchFn(config.ssoVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };

    if (!data.sub || !data.email) return null;

    return {
      ssoSubject: data.sub,
      email: data.email,
      displayName: data.name ?? null,
    };
  } catch {
    return null;
  }
}
