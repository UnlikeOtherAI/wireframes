import { describe, test, expect } from "bun:test";
import { isValidChannel } from "../ws/channels.js";

describe("channel validation", () => {
  test("accepts valid channels", () => {
    expect(isValidChannel("chat.abc123")).toBe(true);
    expect(isValidChannel("project.def-456")).toBe(true);
    expect(isValidChannel("build.my_session")).toBe(true);
  });

  test("rejects invalid channels", () => {
    expect(isValidChannel("")).toBe(false);
    expect(isValidChannel("nocategory")).toBe(false);
    expect(isValidChannel("a.b.c")).toBe(false);
    expect(isValidChannel("Chat.abc")).toBe(false);
    expect(isValidChannel("chat.")).toBe(false);
    expect(isValidChannel(".abc")).toBe(false);
    expect(isValidChannel("chat.abc/def")).toBe(false);
  });
});
