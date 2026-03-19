import { checkHealth } from "../services/health.js";

export async function healthController(): Promise<Response> {
  const health = await checkHealth();
  return Response.json(health);
}
