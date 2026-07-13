import { describe, expect, it, vi } from "vitest";
import { OnlineDomainError, OnlineServiceError } from "./errors";
import {
  onlineErrorResponse,
  readOnlineJsonObject,
  requireNonEmptyString,
} from "./http";

function jsonRequest(headers: HeadersInit = {}, body = "{}") {
  return new Request("http://internal:3000/api/online/lobby", {
    body,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

describe("online HTTP helpers", () => {
  it("accepts a same-origin request behind a reverse proxy", async () => {
    const request = jsonRequest({
      origin: "https://game.example.com",
      "sec-fetch-site": "same-origin",
      "x-forwarded-host": "game.example.com, proxy.internal",
      "x-forwarded-proto": "https, http",
    });

    await expect(readOnlineJsonObject(request)).resolves.toEqual({});
  });

  it("rejects cross-site fetch metadata even without Origin", async () => {
    await expect(readOnlineJsonObject(jsonRequest({ "sec-fetch-site": "cross-site" })))
      .rejects.toMatchObject({ code: "CROSS_SITE_REQUEST", status: 403 });
  });

  it("rejects an Origin that differs from the forwarded application origin", async () => {
    const request = jsonRequest({
      origin: "https://attacker.example",
      "x-forwarded-host": "game.example.com",
      "x-forwarded-proto": "https",
    });

    await expect(readOnlineJsonObject(request))
      .rejects.toMatchObject({ code: "CROSS_SITE_REQUEST", status: 403 });
  });

  it("requires an application/json object body", async () => {
    const request = new Request("http://localhost/api/online/lobby", {
      body: "[]",
      headers: { "content-type": "text/plain" },
      method: "POST",
    });
    await expect(readOnlineJsonObject(request))
      .rejects.toMatchObject({ code: "INVALID_CONTENT_TYPE", status: 400 });

    await expect(readOnlineJsonObject(jsonRequest({}, "[]")))
      .rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
  });

  it("trims required string fields", () => {
    expect(requireNonEmptyString("  player-id  ", "challengedId")).toBe("player-id");
    expect(() => requireNonEmptyString(" ", "challengedId"))
      .toThrow(expect.objectContaining({ code: "INVALID_REQUEST" }));
  });

  it.each([
    [new OnlineServiceError("AUTH_REQUIRED", "auth"), 401],
    [new OnlineServiceError("PLAYER_ROLE_REQUIRED", "role"), 403],
    [new OnlineServiceError("CHALLENGE_NOT_FOUND", "missing"), 404],
    [new OnlineServiceError("PLAYER_NOT_AVAILABLE", "busy"), 409],
    [new OnlineServiceError("DATABASE_REQUIRED", "database"), 503],
    [new OnlineDomainError("INVALID_PLAYER", "invalid"), 400],
    [new OnlineDomainError("VERSION_CONFLICT", "stale"), 409],
  ])("maps a known error to status %s", async (error, expectedStatus) => {
    const response = onlineErrorResponse(error);
    expect(response.status).toBe(expectedStatus);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: expect.any(String), message: error.message },
    });
  });

  it("does not disclose unknown errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = onlineErrorResponse(new Error("database password leaked"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ONLINE_SERVICE_UNAVAILABLE",
        message: "Online service is temporarily unavailable.",
      },
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
