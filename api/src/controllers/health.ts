import { checkHealth } from "../services/health.js";

export async function healthController(): Promise<Response> {
  const health = await checkHealth();
  const status = health.status === "ok" ? 200 : 503;
  return Response.json(health, { status });
}
