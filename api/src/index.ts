import { config } from "./config.js";
import { verifyConnection } from "./db/index.js";
import { compose } from "./middleware/compose.js";
import { cors } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { router } from "./routes/index.js";
import { tryUpgrade } from "./ws/upgrade.js";
import {
  handleOpen,
  handleMessage,
  handleClose,
  handleError,
} from "./ws/handlers.js";
import type { WsData } from "./ws/types.js";

const handler = compose(requestLogger, cors, errorHandler)(router);

// Extracted so TypeScript doesn't reject the `error` handler via excess-property
// checking — bun-types 1.3.x omits it from WebSocketHandler but Bun supports it.
const wsHandlers = {
  open: handleOpen,
  message: handleMessage,
  close: handleClose,
  error: handleError,
};

const server = Bun.serve<WsData>({
  port: config.port,
  async fetch(req, server) {
    if (tryUpgrade(req, server)) {
      return undefined as unknown as Response;
    }
    return handler(req);
  },
  websocket: wsHandlers,
});

const dbOk = await verifyConnection();
if (!dbOk) {
  console.error("Database connection failed — aborting startup");
  process.exit(1);
}
console.log("Database connection verified");

console.log(`API server listening on http://localhost:${server.port}`);
