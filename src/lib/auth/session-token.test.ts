import { describe, expect, it } from "vitest";
import {
  createOpaqueSessionToken,
  createSignedSessionToken,
  hashSessionToken,
  verifySignedSessionToken,
} from "@/lib/auth/session-token";

const SECRET = "a-test-secret-that-is-long-enough";
const NOW = new Date("2026-07-12T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-08-11T10:00:00.000Z");

describe("database session tokens", () => {
  it("creates opaque random tokens and deterministic hashes", () => {
    const first = createOpaqueSessionToken();
    const second = createOpaqueSessionToken();

    expect(first).not.toBe(second);
    expect(first).toHaveLength(43);
    expect(hashSessionToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
    expect(hashSessionToken(first)).not.toContain(first);
  });
});

describe("signed file session tokens", () => {
  it("round-trips a user id without storing it as raw cookie text", () => {
    const userId = "user-with-private-id-123";
    const token = createSignedSessionToken(userId, EXPIRES_AT, SECRET);

    expect(token).not.toContain(userId);
    expect(verifySignedSessionToken(token, SECRET, NOW)).toBe(userId);
  });

  it("rejects tampered payloads and signatures", () => {
    const token = createSignedSessionToken("user-1", EXPIRES_AT, SECRET);
    const [version, payload, signature] = token.split(".");
    const changedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
    const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

    expect(verifySignedSessionToken(`${version}.${changedPayload}.${signature}`, SECRET, NOW)).toBeNull();
    expect(verifySignedSessionToken(`${version}.${payload}.${changedSignature}`, SECRET, NOW)).toBeNull();
    expect(verifySignedSessionToken(token, "a-different-secret", NOW)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createSignedSessionToken("user-1", EXPIRES_AT, SECRET);

    expect(verifySignedSessionToken(token, SECRET, EXPIRES_AT)).toBeNull();
    expect(
      verifySignedSessionToken(token, SECRET, new Date(EXPIRES_AT.getTime() + 1_000)),
    ).toBeNull();
  });
});
