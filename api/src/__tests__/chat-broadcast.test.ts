import { describe, test, expect } from "bun:test";
import { setServer, broadcastToChannel } from "../ws/broadcast.js";

describe("broadcast module", () => {
  test("broadcastToChannel does not throw without server", () => {
    expect(() =>
      broadcastToChannel("test.123", "event", { data: "test" }),
    ).not.toThrow();
  });

  test("setServer accepts a server-like object", () => {
    const published: Array<{ topic: string; data: string }> = [];
    const fakeServer = {
      publish(topic: string, data: string) {
        published.push({ topic, data });
      },
    };
    setServer(fakeServer as any);

    broadcastToChannel("test.channel", "test.event", { msg: "hi" });

    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe("test.channel");
    const parsed = JSON.parse(published[0].data);
    expect(parsed.type).toBe("test.event");
    expect(parsed.channel).toBe("test.channel");
    expect(parsed.payload.msg).toBe("hi");

    // Reset server to avoid side effects
    setServer(null as any);
  });
});
