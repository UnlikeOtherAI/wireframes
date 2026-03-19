import { config } from "./config.js";
import { verifyConnection } from "./db/index.js";
import { compose } from "./middleware/compose.js";
import { cors } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { router } from "./routes/index.js";
import { tryUpgrade } from "./ws/upgrade.js";
import { handleOpen, handleMessage, handleClose } from "./ws/handlers.js";
import type { WsData } from "./ws/types.js";

const handler = compose(requestLogger, cors, errorHandler)(router);

const server = Bun.serve<WsData>({
  port: config.port,
  async fetch(req, server) {
    if (tryUpgrade(req, server)) {
      return undefined as unknown as Response;
    }
    return handler(req);
  },
  websocket: {
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  },
});

const dbOk = await verifyConnection();
if (dbOk) {
  console.log("Database connection verified");
} else {
  console.warn("Database connection failed — running without DB");
}

console.log(`API server listening on http://localhost:${server.port}`);
