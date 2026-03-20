import { describe, test, expect, mock } from "bun:test";

mock.module("../ws/channel-auth.js", () => ({
  canSubscribeToChannel: async () => true,
}));

import {
  handleMessage,
  handleOpen,
  handleClose,
  handleError,
} from "../ws/handlers.js";
import type { WsSocket, WsData } from "../ws/types.js";

function createMockWs(
  channels = new Set<string>(),
): WsSocket & { sent: string[]; published: Array<{ channel: string; data: string }> } {
  const sent: string[] = [];
  const published: Array<{ channel: string; data: string }> = [];
  return {
    send(data: string) {
      sent.push(data);
    },
    subscribe() {},
    unsubscribe() {},
    publish(channel: string, data: string) {
      published.push({ channel, data });
    },
    data: {
      userId: "test-user",
      email: "test@test.com",
      channels,
    } satisfies WsData,
    sent,
    published,
  } as unknown as WsSocket & { sent: string[]; published: Array<{ channel: string; data: string }> };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("handleOpen", () => {
  test("does not throw", () => {
    const ws = createMockWs();
    expect(() => handleOpen(ws)).not.toThrow();
  });
});

describe("handleError", () => {
  test("does not throw on WebSocket error", () => {
    const ws = createMockWs();
    expect(() => handleError(ws, new Error("connection reset"))).not.toThrow();
  });
});

describe("handleMessage", () => {
  test("returns error for invalid JSON", () => {
    const ws = createMockWs();
    handleMessage(ws, "not json");
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "error",
      payload: "Invalid JSON",
    });
  });

  test("returns error for unknown message type", () => {
    const ws = createMockWs();
    handleMessage(ws, JSON.stringify({ type: "unknown" }));
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "error",
      payload: "Unknown message type",
    });
  });

  test("subscribe to valid channel", async () => {
    const ws = createMockWs();
    handleMessage(ws, JSON.stringify({ type: "subscribe", channel: "chat.room1" }));
    await flushMicrotasks();
    expect(ws.sent).toHaveLength(1);
    const response = JSON.parse(ws.sent[0]);
    expect(response.type).toBe("subscribed");
    expect(response.channel).toBe("chat.room1");
    expect(ws.data.channels.has("chat.room1")).toBe(true);
  });

  test("subscribe without channel returns error", () => {
    const ws = createMockWs();
    handleMessage(ws, JSON.stringify({ type: "subscribe" }));
    expect(JSON.parse(ws.sent[0]).type).toBe("error");
  });

  test("publish to subscribed channel broadcasts via ws.publish", () => {
    const channels = new Set(["chat.room1"]);
    const ws = createMockWs(channels);

    handleMessage(
      ws,
      JSON.stringify({ type: "publish", channel: "chat.room1", payload: "hello" }),
    );

    expect(ws.sent).toHaveLength(0);
    expect(ws.published).toHaveLength(1);
    expect(ws.published[0].channel).toBe("chat.room1");
    const broadcastData = JSON.parse(ws.published[0].data);
    expect(broadcastData.type).toBe("message");
    expect(broadcastData.channel).toBe("chat.room1");
    expect(broadcastData.payload).toBe("hello");
  });

  test("publish without channel returns error", () => {
    const ws = createMockWs();
    handleMessage(ws, JSON.stringify({ type: "publish" }));
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "error",
      payload: "Missing channel",
    });
  });

  test("publish to unsubscribed channel returns error", () => {
    const ws = createMockWs();
    handleMessage(
      ws,
      JSON.stringify({ type: "publish", channel: "chat.room1", payload: "hi" }),
    );
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "error",
      payload: "Not subscribed to channel",
    });
  });
});

describe("handleClose", () => {
  test("clears all channel subscriptions", () => {
    const channels = new Set(["chat.room1", "project.abc"]);
    const ws = createMockWs(channels);
    handleClose(ws, 1000, "normal");
    expect(ws.data.channels.size).toBe(0);
  });
});
