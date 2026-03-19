export type Handler = (req: Request) => Response | Promise<Response>;
export type Middleware = (next: Handler) => Handler;
