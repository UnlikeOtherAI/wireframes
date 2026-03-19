import { healthController } from "../controllers/health.js";

export function handleHealthRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);
  if (url.pathname === "/health" && req.method === "GET") {
    return healthController();
  }
  return null;
}
