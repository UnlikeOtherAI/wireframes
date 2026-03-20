import type { Middleware } from "./types.js";

export class ApiError extends Error {
  public details?: unknown;

  constructor(
    public statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.details = details;
  }
}

export const errorHandler: Middleware = (next) => async (req) => {
  try {
    return await next(req);
  } catch (err) {
    if (err instanceof ApiError) {
      const body: Record<string, unknown> = { error: err.message };
      if (err.details !== undefined) {
        body.details = err.details;
      }
      return Response.json(body, { status: err.statusCode });
    }
    console.error("Unhandled error:", err);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
};
