import { NextResponse } from "next/server";
import { OnlineDomainError, OnlineServiceError } from "@/lib/online/errors";

type OnlineHttpErrorCode =
  | "CROSS_SITE_REQUEST"
  | "INVALID_ACTION"
  | "INVALID_CONTENT_TYPE"
  | "INVALID_JSON"
  | "INVALID_REQUEST";

export class OnlineHttpError extends Error {
  readonly code: OnlineHttpErrorCode;
  readonly status: 400 | 403;

  constructor(code: OnlineHttpErrorCode, message: string, status: 400 | 403 = 400) {
    super(message);
    this.name = "OnlineHttpError";
    this.code = code;
    this.status = status;
  }
}

export function onlineJson<T>(body: T, init?: ResponseInit): NextResponse<T> {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, { ...init, headers });
}

export async function readOnlineJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  assertSameOrigin(request);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new OnlineHttpError(
      "INVALID_CONTENT_TYPE",
      "Content-Type must be application/json.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new OnlineHttpError("INVALID_JSON", "Request body must contain valid JSON.");
  }

  if (!isJsonObject(body)) {
    throw new OnlineHttpError("INVALID_JSON", "Request body must be a JSON object.");
  }

  return body;
}

export function requireNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OnlineHttpError(
      "INVALID_REQUEST",
      `${field} must be a non-empty string.`,
    );
  }
  return value.trim();
}

export function onlineErrorResponse(error: unknown): NextResponse {
  if (error instanceof OnlineHttpError) {
    return onlineJson(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof OnlineServiceError) {
    return onlineJson(
      { error: { code: error.code, message: error.message } },
      { status: serviceErrorStatus(error.code) },
    );
  }

  if (error instanceof OnlineDomainError) {
    return onlineJson(
      { error: { code: error.code, message: error.message } },
      { status: error.code === "VERSION_CONFLICT" ? 409 : 400 },
    );
  }

  console.error("Unhandled online API error", error);
  return onlineJson(
    {
      error: {
        code: "ONLINE_SERVICE_UNAVAILABLE",
        message: "Online service is temporarily unavailable.",
      },
    },
    { status: 503 },
  );
}

function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    throw new OnlineHttpError(
      "CROSS_SITE_REQUEST",
      "Cross-site online requests are not allowed.",
      403,
    );
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new OnlineHttpError("CROSS_SITE_REQUEST", "Request origin is invalid.", 403);
  }

  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? request.headers.get("host")?.trim() ?? new URL(request.url).host;
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProto
    ? `${forwardedProto.replace(/:$/, "").toLowerCase()}:`
    : new URL(request.url).protocol;

  if (parsedOrigin.host.toLowerCase() !== host.toLowerCase() || parsedOrigin.protocol !== protocol) {
    throw new OnlineHttpError(
      "CROSS_SITE_REQUEST",
      "Request origin does not match the application origin.",
      403,
    );
  }
}

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim();
  return first || null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serviceErrorStatus(code: OnlineServiceError["code"]): number {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "CHALLENGE_FORBIDDEN":
    case "DRAW_RESPONSE_FORBIDDEN":
    case "REMATCH_RESPONSE_FORBIDDEN":
    case "PLAYER_NOT_IN_MATCH":
    case "PLAYER_ROLE_REQUIRED":
      return 403;
    case "CHALLENGE_NOT_FOUND":
    case "MATCH_NOT_FOUND":
    case "REMATCH_NOT_FOUND":
      return 404;
    case "CHALLENGE_ALREADY_PENDING":
    case "CHALLENGE_EXPIRED":
    case "CHALLENGE_NOT_PENDING":
    case "DRAW_OFFER_ALREADY_PENDING":
    case "DRAW_OFFER_LIMIT_REACHED":
    case "DRAW_OFFER_NOT_PENDING":
    case "PLAYER_NOT_AVAILABLE":
    case "REMATCH_ALREADY_PENDING":
    case "REMATCH_MATCH_NOT_FINISHED":
    case "REMATCH_NOT_PENDING":
    case "INSUFFICIENT_MAGIC_COINS":
    case "MATCH_FINISHED":
    case "NOT_PLAYER_TURN":
    case "REQUEST_ID_REUSED":
    case "VERSION_CONFLICT":
      return 409;
    case "ILLEGAL_MOVE":
    case "INVALID_CLIENT_REQUEST_ID":
    case "INVALID_DRAW_ACTION":
    case "REMATCH_CHALLENGE_REQUIRED":
    case "INVALID_MAGIC":
    case "INVALID_MAGIC_TARGET":
    case "PLAYER_IN_CHECK":
      return 400;
    case "DATABASE_REQUIRED":
      return 503;
  }
}
