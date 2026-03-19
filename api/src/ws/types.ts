import type { ServerWebSocket } from "bun";

export interface WsData {
  userId: string;
  email: string;
  channels: Set<string>;
}

export type WsSocket = ServerWebSocket<WsData>;

export interface WsMessage {
  type: string;
  channel?: string;
  payload?: unknown;
}
