import type { Server } from "bun";
import type { WsData } from "./types.js";

let serverRef: Server<WsData> | null = null;

export function setServer(server: Server<WsData>): void {
  serverRef = server;
}

export function broadcastToChannel(
  channel: string,
  event: string,
  payload: unknown,
): void {
  if (!serverRef) return;
  serverRef.publish(
    channel,
    JSON.stringify({ type: event, channel, payload }),
  );
}
