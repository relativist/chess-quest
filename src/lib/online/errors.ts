export type OnlineDomainErrorCode =
  | "INVALID_CLOCK"
  | "INVALID_DRAW_OFFER_COUNT"
  | "INVALID_FEN_TURN"
  | "INVALID_PLAYER"
  | "INVALID_RANDOM_VALUE"
  | "INVALID_TIMESTAMP"
  | "INVALID_VERSION"
  | "PLAYER_NOT_IN_MATCH"
  | "PLAYERS_MUST_BE_DISTINCT"
  | "DRAW_OFFER_ALREADY_PENDING"
  | "DRAW_OFFER_LIMIT_REACHED"
  | "VERSION_CONFLICT";

export type OnlineServiceErrorCode =
  | "AUTH_REQUIRED"
  | "CHALLENGE_ALREADY_PENDING"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_FORBIDDEN"
  | "CHALLENGE_NOT_FOUND"
  | "CHALLENGE_NOT_PENDING"
  | "DATABASE_REQUIRED"
  | "PLAYER_NOT_AVAILABLE"
  | "PLAYER_ROLE_REQUIRED"
  | "ILLEGAL_MOVE"
  | "INSUFFICIENT_MAGIC_COINS"
  | "INVALID_CLIENT_REQUEST_ID"
  | "INVALID_MAGIC"
  | "INVALID_MAGIC_TARGET"
  | "DRAW_OFFER_ALREADY_PENDING"
  | "DRAW_OFFER_LIMIT_REACHED"
  | "DRAW_OFFER_NOT_PENDING"
  | "DRAW_RESPONSE_FORBIDDEN"
  | "INVALID_DRAW_ACTION"
  | "MATCH_FINISHED"
  | "MATCH_NOT_FOUND"
  | "NOT_PLAYER_TURN"
  | "PLAYER_IN_CHECK"
  | "PLAYER_NOT_IN_MATCH"
  | "REMATCH_ALREADY_PENDING"
  | "REMATCH_CHALLENGE_REQUIRED"
  | "REMATCH_MATCH_NOT_FINISHED"
  | "REMATCH_NOT_FOUND"
  | "REMATCH_NOT_PENDING"
  | "REMATCH_RESPONSE_FORBIDDEN"
  | "REQUEST_ID_REUSED"
  | "VERSION_CONFLICT";

export class OnlineDomainError extends Error {
  readonly code: OnlineDomainErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: OnlineDomainErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "OnlineDomainError";
    this.code = code;
    this.details = details;
  }
}

export class OnlineServiceError extends Error {
  readonly code: OnlineServiceErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: OnlineServiceErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "OnlineServiceError";
    this.code = code;
    this.details = details;
  }
}

export type OnlineDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OnlineDomainError };

export function onlineDomainResult<T>(operation: () => T): OnlineDomainResult<T> {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    if (error instanceof OnlineDomainError) return { ok: false, error };
    throw error;
  }
}
