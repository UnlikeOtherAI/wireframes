import type { WsSocket } from "./types.js";

const CHANNEL_PATTERN = /^[a-z]+\.[a-zA-Z0-9_-]+$/;

export function isValidChannel(channel: string): boolean {
  return CHANNEL_PATTERN.test(channel);
}

export function subscribeToChannel(ws: WsSocket, channel: string): boolean {
  if (!isValidChannel(channel)) return false;
  ws.subscribe(channel);
  ws.data.channels.add(channel);
  return true;
}

export function unsubscribeFromChannel(
  ws: WsSocket,
  channel: string,
): boolean {
  if (!ws.data.channels.has(channel)) return false;
  ws.unsubscribe(channel);
  ws.data.channels.delete(channel);
  return true;
}

export function unsubscribeAll(ws: WsSocket): void {
  for (const channel of ws.data.channels) {
    ws.unsubscribe(channel);
  }
  ws.data.channels.clear();
}

export function publishToChannel(
  ws: WsSocket,
  channel: string,
  payload: unknown,
): boolean {
  if (!ws.data.channels.has(channel)) return false;
  ws.publish(
    channel,
    JSON.stringify({ type: "message", channel, payload }),
  );
  return true;
}
