import type { Middleware } from "./types.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errorHandler: Middleware = (next) => async (req) => {
  try {
    return await next(req);
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    console.error("Unhandled error:", err);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
};
