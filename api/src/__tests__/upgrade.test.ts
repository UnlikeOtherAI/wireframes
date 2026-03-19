import { describe, test, expect, beforeEach } from "bun:test";
import { setJwtVerifier, tryUpgrade } from "../ws/upgrade.js";
import type { Server } from "bun";
import type { WsData } from "../ws/types.js";

function makeRequest(path: string, headers?: Record<string, string>): Request {
  return new Request(`http://localhost${path}`, { headers });
}

function makeServer(): { upgraded: boolean; data: unknown; server: Server<WsData> } {
  const state = { upgraded: false, data: null as unknown };
  return {
    ...state,
    server: {
      upgrade(
        _req: Request,
        opts: { data: unknown },
      ): boolean {
        state.upgraded = true;
        state.data = opts.data;
        return true;
      },
    } as unknown as Server<WsData>,
  };
}

describe("WebSocket upgrade", () => {
  beforeEach(() => {
    setJwtVerifier(() => null);
  });

  test("ignores non-/ws paths", () => {
    const s = makeServer();
    const result = tryUpgrade(makeRequest("/health"), s.server);
    expect(result).toBe(false);
    expect(s.upgraded).toBe(false);
  });

  test("rejects upgrade without token", () => {
    const s = makeServer();
    const result = tryUpgrade(makeRequest("/ws"), s.server);
    expect(result).toBe(false);
  });

  test("rejects upgrade with invalid token", () => {
    setJwtVerifier(() => null);
    const s = makeServer();
    const result = tryUpgrade(makeRequest("/ws?token=bad"), s.server);
    expect(result).toBe(false);
  });

  test("upgrades with valid token from query param", () => {
    setJwtVerifier((token) =>
      token === "valid" ? { userId: "u1", email: "a@b.com" } : null,
    );
    const s = makeServer();
    const result = tryUpgrade(makeRequest("/ws?token=valid"), s.server);
    expect(result).toBe(true);
  });

  test("upgrades with valid token from cookie", () => {
    setJwtVerifier((token) =>
      token === "cookie-token" ? { userId: "u2", email: "c@d.com" } : null,
    );
    const s = makeServer();
    const result = tryUpgrade(
      makeRequest("/ws", { Cookie: "session=cookie-token" }),
      s.server,
    );
    expect(result).toBe(true);
  });
});
