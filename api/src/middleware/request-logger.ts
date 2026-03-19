import type { Middleware } from "./types.js";

export const requestLogger: Middleware = (next) => async (req) => {
  const start = performance.now();
  const { method } = req;
  const url = new URL(req.url);

  const res = await next(req);

  const duration = (performance.now() - start).toFixed(1);
  console.log(`${method} ${url.pathname} ${res.status} ${duration}ms`);

  return res;
};
