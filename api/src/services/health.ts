import { verifyConnection } from "../db/index.js";

export interface HealthStatus {
  status: "ok";
  timestamp: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const ok = await verifyConnection();
  if (!ok) {
    throw new Error("Database connection failed");
  }
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
}
