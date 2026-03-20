function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
  jwtSecret: requireEnv("JWT_SECRET"),
  devAuthEnabled: process.env.DEV_AUTH_ENABLED === "true",
  devAuthUserEmail:
    process.env.DEV_AUTH_USER_EMAIL || "dev@wireframes.local",
  devAuthUserName:
    process.env.DEV_AUTH_USER_NAME || "Local Developer",
  devAuthUserSubject:
    process.env.DEV_AUTH_USER_SUBJECT || "dev-local-user",
  devAuthProjectName:
    process.env.DEV_AUTH_PROJECT_NAME || "Local Demo Project",
  ssoVerifyUrl:
    process.env.SSO_VERIFY_URL ||
    "https://authenticator.unlikeother.ai/verify",
  gcsBucket: process.env.GCS_BUCKET || "",
  gcsServiceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY || "",
} as const;
