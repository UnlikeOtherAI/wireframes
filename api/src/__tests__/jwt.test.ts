import { describe, test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { signJwt, verifyJwt } from "../services/jwt.js";

const SECRET = "test-secret-key-for-jwt-testing";

describe("JWT", () => {
  test("signJwt returns a three-part token", () => {
    const token = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    expect(token.split(".").length).toBe(3);
  });

  test("verifyJwt returns payload for valid token", () => {
    const token = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    const payload = verifyJwt(token, SECRET);
    expect(payload).toEqual({ userId: "u1", email: "a@b.com" });
  });

  test("verifyJwt returns null for wrong secret", () => {
    const token = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    const payload = verifyJwt(token, "wrong-secret");
    expect(payload).toBeNull();
  });

  test("verifyJwt returns null for malformed token", () => {
    expect(verifyJwt("not.a.jwt", SECRET)).toBeNull();
    expect(verifyJwt("", SECRET)).toBeNull();
    expect(verifyJwt("onlyonepart", SECRET)).toBeNull();
  });

  test("verifyJwt returns null for tampered payload", () => {
    const token = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    const parts = token.split(".");
    // Tamper with payload
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - (parts[1].length % 4)) % 4),
        "base64",
      ).toString(),
    );
    payload.userId = "hacked";
    const tampered =
      Buffer.from(JSON.stringify(payload))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    const result = verifyJwt(`${parts[0]}.${tampered}.${parts[2]}`, SECRET);
    expect(result).toBeNull();
  });

  test("verifyJwt returns null for expired token", () => {
    const token = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    const parts = token.split(".");
    const payloadStr = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (parts[1].length % 4)) % 4),
      "base64",
    ).toString();
    const payload = JSON.parse(payloadStr);
    payload.exp = Math.floor(Date.now() / 1000) - 3600;
    const newPayload = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const sig = createHmac("sha256", SECRET)
      .update(`${parts[0]}.${newPayload}`)
      .digest()
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const expired = `${parts[0]}.${newPayload}.${sig}`;
    expect(verifyJwt(expired, SECRET)).toBeNull();
  });

  test("signJwt produces different tokens for different payloads", () => {
    const t1 = signJwt({ userId: "u1", email: "a@b.com" }, SECRET);
    const t2 = signJwt({ userId: "u2", email: "c@d.com" }, SECRET);
    expect(t1).not.toBe(t2);
  });
});
