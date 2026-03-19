import type { WsSocket, WsMessage } from "./types.js";
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  unsubscribeAll,
  publishToChannel,
} from "./channels.js";

export function handleOpen(ws: WsSocket): void {
  console.log(`WS connected: user=${ws.data.userId}`);
}

export function handleMessage(ws: WsSocket, raw: string | Buffer): void {
  let msg: WsMessage;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    ws.send(JSON.stringify({ type: "error", payload: "Invalid JSON" }));
    return;
  }

  switch (msg.type) {
    case "subscribe": {
      if (!msg.channel) {
        ws.send(
          JSON.stringify({ type: "error", payload: "Missing channel" }),
        );
        return;
      }
      const ok = subscribeToChannel(ws, msg.channel);
      ws.send(
        JSON.stringify({
          type: ok ? "subscribed" : "error",
          channel: msg.channel,
          ...(ok ? {} : { payload: "Invalid channel format" }),
        }),
      );
      break;
    }
    case "unsubscribe": {
      if (!msg.channel) {
        ws.send(
          JSON.stringify({ type: "error", payload: "Missing channel" }),
        );
        return;
      }
      unsubscribeFromChannel(ws, msg.channel);
      ws.send(
        JSON.stringify({ type: "unsubscribed", channel: msg.channel }),
      );
      break;
    }
    case "publish": {
      if (!msg.channel) {
        ws.send(
          JSON.stringify({ type: "error", payload: "Missing channel" }),
        );
        return;
      }
      const published = publishToChannel(ws, msg.channel, msg.payload);
      if (!published) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: "Not subscribed to channel",
          }),
        );
      }
      break;
    }
    default:
      ws.send(
        JSON.stringify({ type: "error", payload: "Unknown message type" }),
      );
  }
}

export function handleError(ws: WsSocket, error: Error): void {
  console.error(`WS error: user=${ws.data.userId} error=${error.message}`);
}

export function handleClose(ws: WsSocket, code: number, reason: string): void {
  unsubscribeAll(ws);
  console.log(
    `WS disconnected: user=${ws.data.userId} code=${code} reason=${reason}`,
  );
}
