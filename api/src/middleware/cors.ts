import { config } from "../config.js";
import type { Middleware } from "./types.js";

export const cors: Middleware = (next) => async (req) => {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    config.corsOrigins.length === 0 || config.corsOrigins.includes(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(allowed ? origin : ""),
    });
  }

  const res = await next(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(allowed ? origin : ""))) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

function corsHeaders(origin: string): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
