import { describe, test, expect } from "bun:test";
import { compose } from "../middleware/compose.js";
import { errorHandler, ApiError } from "../middleware/error-handler.js";
import { requestLogger } from "../middleware/request-logger.js";
import type { Handler, Middleware } from "../middleware/types.js";

function makeRequest(path = "/test", method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("compose", () => {
  test("applies middlewares in order", async () => {
    const order: number[] = [];

    const mw1: Middleware = (next) => async (req) => {
      order.push(1);
      const res = await next(req);
      order.push(4);
      return res;
    };
    const mw2: Middleware = (next) => async (req) => {
      order.push(2);
      const res = await next(req);
      order.push(3);
      return res;
    };

    const handler: Handler = () => new Response("ok");
    const composed = compose(mw1, mw2)(handler);
    await composed(makeRequest());

    expect(order).toEqual([1, 2, 3, 4]);
  });

  test("returns handler response when no middleware", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const composed = compose()(handler);
    const res = await composed(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("errorHandler", () => {
  test("passes through successful responses", async () => {
    const handler: Handler = () => Response.json({ ok: true });
    const wrapped = errorHandler(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("catches ApiError and returns structured JSON", async () => {
    const handler: Handler = () => {
      throw new ApiError(400, "Bad request");
    };
    const wrapped = errorHandler(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Bad request" });
  });

  test("catches unknown errors and returns 500", async () => {
    const handler: Handler = () => {
      throw new Error("unexpected");
    };
    const wrapped = errorHandler(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal Server Error" });
  });
});

describe("requestLogger", () => {
  test("passes through response unchanged", async () => {
    const handler: Handler = () => Response.json({ data: 1 }, { status: 201 });
    const wrapped = requestLogger(handler);
    const res = await wrapped(makeRequest("/foo", "POST"));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: 1 });
  });
});
