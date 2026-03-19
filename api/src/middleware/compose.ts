import type { Handler, Middleware } from "./types.js";

export function compose(...middlewares: Middleware[]): Middleware {
  return (handler: Handler): Handler => {
    let current = handler;
    for (let i = middlewares.length - 1; i >= 0; i--) {
      current = middlewares[i](current);
    }
    return current;
  };
}
