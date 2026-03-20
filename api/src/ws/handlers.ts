import type { WsSocket, WsMessage } from "./types.js";
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  unsubscribeAll,
  publishToChannel,
} from "./channels.js";
import { canSubscribeToChannel } from "./channel-auth.js";

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
      handleSubscribe(ws, msg.channel);
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

async function handleSubscribe(ws: WsSocket, channel: string): Promise<void> {
  const authorized = await canSubscribeToChannel(ws.data.userId, channel);
  if (!authorized) {
    ws.send(
      JSON.stringify({
        type: "error",
        channel,
        payload: "Not authorized to subscribe to this channel",
      }),
    );
    return;
  }

  const ok = subscribeToChannel(ws, channel);
  ws.send(
    JSON.stringify({
      type: ok ? "subscribed" : "error",
      channel,
      ...(ok ? {} : { payload: "Invalid channel format" }),
    }),
  );
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
