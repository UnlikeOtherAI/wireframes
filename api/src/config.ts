export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "",
  ssoVerifyUrl:
    process.env.SSO_VERIFY_URL ||
    "https://authenticator.unlikeother.ai/verify",
} as const;
