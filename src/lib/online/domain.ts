import {
  ONLINE_MAX_DRAW_OFFERS_PER_PLAYER,
  ONLINE_PRESENCE_TTL_MS,
} from "./constants";
import { OnlineDomainError } from "./errors";
import type {
  DebitedOnlineMatchClocks,
  OnlineColor,
  OnlineColorAssignment,
  OnlineMatchClocks,
  OnlineMatchPlayers,
  PublicOnlinePlayer,
} from "./types";

type PublicPlayerSource = {
  id: string;
  name: string;
  onlineRating: number;
};

export function toPublicOnlinePlayer(player: PublicPlayerSource): PublicOnlinePlayer {
  assertPlayerId(player.id);
  if (!player.name.trim() || !Number.isInteger(player.onlineRating) || player.onlineRating < 0) {
    throw new OnlineDomainError("INVALID_PLAYER", "Online player has invalid public fields.");
  }

  return {
    id: player.id,
    name: player.name,
    onlineRating: player.onlineRating,
  };
}

export function activeChallengeKey(firstPlayerId: string, secondPlayerId: string): string {
  assertDistinctPlayers(firstPlayerId, secondPlayerId);
  return JSON.stringify([firstPlayerId, secondPlayerId].sort());
}

export function isPresenceFresh(
  lastSeenAt: Date | number,
  now: Date | number = Date.now(),
  ttlMs = ONLINE_PRESENCE_TTL_MS,
): boolean {
  const lastSeenMs = timestampMs(lastSeenAt);
  const nowMs = timestampMs(now);

  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new OnlineDomainError("INVALID_TIMESTAMP", "Presence TTL must be positive.", { ttlMs });
  }

  const ageMs = nowMs - lastSeenMs;
  return ageMs >= 0 && ageMs < ttlMs;
}

export function areDistinctPlayers(firstPlayerId: string, secondPlayerId: string): boolean {
  assertPlayerId(firstPlayerId);
  assertPlayerId(secondPlayerId);
  return firstPlayerId !== secondPlayerId;
}

export function assertDistinctPlayers(firstPlayerId: string, secondPlayerId: string): void {
  if (!areDistinctPlayers(firstPlayerId, secondPlayerId)) {
    throw new OnlineDomainError(
      "PLAYERS_MUST_BE_DISTINCT",
      "Online action requires two distinct players.",
      { firstPlayerId, secondPlayerId },
    );
  }
}

export function assignRandomColors(
  firstPlayerId: string,
  secondPlayerId: string,
  random: () => number = Math.random,
): OnlineColorAssignment {
  assertDistinctPlayers(firstPlayerId, secondPlayerId);
  const randomValue = random();

  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new OnlineDomainError(
      "INVALID_RANDOM_VALUE",
      "Random source must return a finite value in the [0, 1) range.",
      { randomValue },
    );
  }

  return randomValue < 0.5
    ? { whitePlayerId: firstPlayerId, blackPlayerId: secondPlayerId }
    : { whitePlayerId: secondPlayerId, blackPlayerId: firstPlayerId };
}

export function assertExpectedVersion(actualVersion: number, expectedVersion: number): void {
  assertVersion(actualVersion, "actualVersion");
  assertVersion(expectedVersion, "expectedVersion");

  if (actualVersion !== expectedVersion) {
    throw new OnlineDomainError("VERSION_CONFLICT", "Online match version is stale.", {
      actualVersion,
      expectedVersion,
    });
  }
}

export function debitActiveClock(input: {
  clocks: OnlineMatchClocks;
  fen: string;
  now: Date | number;
  turnStartedAt: Date | number;
}): DebitedOnlineMatchClocks {
  assertClock(input.clocks.whiteTimeMs, "whiteTimeMs");
  assertClock(input.clocks.blackTimeMs, "blackTimeMs");

  const turnStartedAtMs = timestampMs(input.turnStartedAt);
  const nowMs = timestampMs(input.now);
  const elapsedMs = nowMs - turnStartedAtMs;
  if (elapsedMs < 0) {
    throw new OnlineDomainError("INVALID_TIMESTAMP", "Turn start cannot be in the future.", {
      nowMs,
      turnStartedAtMs,
    });
  }

  const activeColor = fenSideToMove(input.fen);
  const activeClock = activeColor === "white"
    ? input.clocks.whiteTimeMs
    : input.clocks.blackTimeMs;
  const remainingMs = Math.max(0, activeClock - elapsedMs);

  return {
    whiteTimeMs: activeColor === "white" ? remainingMs : input.clocks.whiteTimeMs,
    blackTimeMs: activeColor === "black" ? remainingMs : input.clocks.blackTimeMs,
    activeColor,
    elapsedMs,
    timedOut: remainingMs === 0,
  };
}

export function assertCanOfferDraw(input: {
  offerCount: number;
  pendingDrawOfferById: string | null;
}): void {
  assertDrawOfferCount(input.offerCount);

  if (input.offerCount >= ONLINE_MAX_DRAW_OFFERS_PER_PLAYER) {
    throw new OnlineDomainError("DRAW_OFFER_LIMIT_REACHED", "Player has no draw offers left.", {
      offerCount: input.offerCount,
    });
  }

  if (input.pendingDrawOfferById !== null) {
    assertPlayerId(input.pendingDrawOfferById);
    throw new OnlineDomainError(
      "DRAW_OFFER_ALREADY_PENDING",
      "A draw offer is already pending.",
      { pendingDrawOfferById: input.pendingDrawOfferById },
    );
  }
}

export function nextDrawOfferCount(input: {
  offerCount: number;
  pendingDrawOfferById: string | null;
}): number {
  assertCanOfferDraw(input);
  return input.offerCount + 1;
}

export function isMatchParticipant(match: OnlineMatchPlayers, playerId: string): boolean {
  assertMatchPlayers(match);
  assertPlayerId(playerId);
  return match.whitePlayerId === playerId || match.blackPlayerId === playerId;
}

export function matchColorForPlayer(match: OnlineMatchPlayers, playerId: string): OnlineColor {
  if (!isMatchParticipant(match, playerId)) {
    throw new OnlineDomainError("PLAYER_NOT_IN_MATCH", "Player is not a match participant.", {
      playerId,
    });
  }
  return match.whitePlayerId === playerId ? "white" : "black";
}

export function opponentIdForPlayer(match: OnlineMatchPlayers, playerId: string): string {
  const color = matchColorForPlayer(match, playerId);
  return color === "white" ? match.blackPlayerId : match.whitePlayerId;
}

function assertMatchPlayers(match: OnlineMatchPlayers): void {
  assertDistinctPlayers(match.whitePlayerId, match.blackPlayerId);
}

function assertPlayerId(playerId: string): void {
  if (typeof playerId !== "string" || !playerId.trim()) {
    throw new OnlineDomainError("INVALID_PLAYER", "Player id must be a non-empty string.");
  }
}

function assertVersion(version: number, field: string): void {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new OnlineDomainError("INVALID_VERSION", "Version must be a non-negative safe integer.", {
      field,
      version,
    });
  }
}

function assertClock(clockMs: number, field: string): void {
  if (!Number.isSafeInteger(clockMs) || clockMs < 0) {
    throw new OnlineDomainError("INVALID_CLOCK", "Clock must be a non-negative safe integer.", {
      clockMs,
      field,
    });
  }
}

function assertDrawOfferCount(offerCount: number): void {
  if (!Number.isSafeInteger(offerCount) || offerCount < 0) {
    throw new OnlineDomainError(
      "INVALID_DRAW_OFFER_COUNT",
      "Draw offer count must be a non-negative safe integer.",
      { offerCount },
    );
  }
}

function timestampMs(value: Date | number): number {
  const milliseconds = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(milliseconds)) {
    throw new OnlineDomainError("INVALID_TIMESTAMP", "Timestamp must be finite.", { value });
  }
  return milliseconds;
}

function fenSideToMove(fen: string): OnlineColor {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6 || (fields[1] !== "w" && fields[1] !== "b")) {
    throw new OnlineDomainError("INVALID_FEN_TURN", "FEN must contain a valid side to move.");
  }
  return fields[1] === "w" ? "white" : "black";
}
