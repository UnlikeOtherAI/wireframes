import { verifyConnection } from "../db/index.js";

export interface HealthStatus {
  status: "ok" | "degraded";
  timestamp: string;
  db: boolean;
}

export async function checkHealth(): Promise<HealthStatus> {
  const db = await verifyConnection();
  return {
    status: db ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    db,
  };
}
