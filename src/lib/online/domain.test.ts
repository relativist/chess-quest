import { describe, expect, it } from "vitest";
import {
  ONLINE_CHALLENGE_TTL_MS,
  ONLINE_INITIAL_CLOCK_MS,
  ONLINE_INITIAL_MAGIC_COINS,
  ONLINE_MAX_DRAW_OFFERS_PER_PLAYER,
  ONLINE_PRESENCE_TTL_MS,
  OnlineDomainError,
  activeChallengeKey,
  areDistinctPlayers,
  assertCanOfferDraw,
  assertExpectedVersion,
  assignRandomColors,
  debitActiveClock,
  isMatchParticipant,
  isPresenceFresh,
  matchColorForPlayer,
  nextDrawOfferCount,
  onlineDomainResult,
  opponentIdForPlayer,
  toPublicOnlinePlayer,
} from ".";

const match = { whitePlayerId: "white-id", blackPlayerId: "black-id" };

function expectDomainError(operation: () => unknown, code: OnlineDomainError["code"]) {
  try {
    operation();
    throw new Error("Expected OnlineDomainError");
  } catch (error) {
    expect(error).toBeInstanceOf(OnlineDomainError);
    expect((error as OnlineDomainError).code).toBe(code);
  }
}

describe("online domain constants", () => {
  it("defines the first release limits", () => {
    expect(ONLINE_PRESENCE_TTL_MS).toBe(30_000);
    expect(ONLINE_CHALLENGE_TTL_MS).toBe(30_000);
    expect(ONLINE_INITIAL_CLOCK_MS).toBe(600_000);
    expect(ONLINE_INITIAL_MAGIC_COINS).toBe(500);
    expect(ONLINE_MAX_DRAW_OFFERS_PER_PLAYER).toBe(3);
  });
});

describe("online lobby helpers", () => {
  it("builds one collision-safe key for either player order", () => {
    expect(activeChallengeKey("player:b", "player|a"))
      .toBe(activeChallengeKey("player|a", "player:b"));
    expect(activeChallengeKey("ab", "c")).not.toBe(activeChallengeKey("a", "bc"));
  });

  it("rejects self challenges and empty ids", () => {
    expectDomainError(() => activeChallengeKey("same", "same"), "PLAYERS_MUST_BE_DISTINCT");
    expectDomainError(() => areDistinctPlayers("", "player"), "INVALID_PLAYER");
  });

  it("treats presence as expired exactly at TTL and rejects future timestamps", () => {
    expect(isPresenceFresh(1_000, 1_000 + ONLINE_PRESENCE_TTL_MS - 1)).toBe(true);
    expect(isPresenceFresh(1_000, 1_000 + ONLINE_PRESENCE_TTL_MS)).toBe(false);
    expect(isPresenceFresh(1_001, 1_000)).toBe(false);
    expectDomainError(() => isPresenceFresh(Number.NaN, 1_000), "INVALID_TIMESTAMP");
  });

  it("returns only the explicitly public player fields", () => {
    const source = {
      id: "player",
      name: "Alice",
      onlineRating: 7,
      passwordHash: "must-not-leak",
    };

    expect(toPublicOnlinePlayer(source)).toEqual({
      id: "player",
      name: "Alice",
      onlineRating: 7,
    });
    expectDomainError(
      () => toPublicOnlinePlayer({ id: "player", name: "Alice", onlineRating: -1 }),
      "INVALID_PLAYER",
    );
  });
});

describe("online match foundation", () => {
  it("assigns both color branches with an injected random source", () => {
    expect(assignRandomColors("first", "second", () => 0)).toEqual({
      whitePlayerId: "first",
      blackPlayerId: "second",
    });
    expect(assignRandomColors("first", "second", () => 0.5)).toEqual({
      whitePlayerId: "second",
      blackPlayerId: "first",
    });
  });

  it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid random value %s",
    (randomValue) => {
      expectDomainError(
        () => assignRandomColors("first", "second", () => randomValue),
        "INVALID_RANDOM_VALUE",
      );
    },
  );

  it("accepts the current version and exposes conflicts as typed results", () => {
    expect(() => assertExpectedVersion(4, 4)).not.toThrow();

    const result = onlineDomainResult(() => assertExpectedVersion(4, 3));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VERSION_CONFLICT");
      expect(result.error.details).toEqual({ actualVersion: 4, expectedVersion: 3 });
    }
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid version %s", (version) => {
    expectDomainError(() => assertExpectedVersion(0, version), "INVALID_VERSION");
  });

  it("debits only the white clock when FEN says white to move", () => {
    expect(debitActiveClock({
      clocks: { whiteTimeMs: 10_000, blackTimeMs: 8_000 },
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      turnStartedAt: 1_000,
      now: 3_500,
    })).toEqual({
      whiteTimeMs: 7_500,
      blackTimeMs: 8_000,
      activeColor: "white",
      elapsedMs: 2_500,
      timedOut: false,
    });
  });

  it("clamps the black clock at zero exactly on timeout", () => {
    expect(debitActiveClock({
      clocks: { whiteTimeMs: 10_000, blackTimeMs: 2_500 },
      fen: "8/8/8/8/8/8/8/8 b - - 0 1",
      turnStartedAt: 1_000,
      now: 3_500,
    })).toMatchObject({ blackTimeMs: 0, whiteTimeMs: 10_000, timedOut: true });
  });

  it("rejects forged clock, timestamp and FEN turn inputs", () => {
    expectDomainError(() => debitActiveClock({
      clocks: { whiteTimeMs: -1, blackTimeMs: 10 },
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      turnStartedAt: 0,
      now: 1,
    }), "INVALID_CLOCK");
    expectDomainError(() => debitActiveClock({
      clocks: { whiteTimeMs: 10, blackTimeMs: 10 },
      fen: "8/8/8/8/8/8/8/8 x - - 0 1",
      turnStartedAt: 0,
      now: 1,
    }), "INVALID_FEN_TURN");
    expectDomainError(() => debitActiveClock({
      clocks: { whiteTimeMs: 10, blackTimeMs: 10 },
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      turnStartedAt: 2,
      now: 1,
    }), "INVALID_TIMESTAMP");
  });
});

describe("draw and participant helpers", () => {
  it("allows exactly three draw offers per player", () => {
    expect(nextDrawOfferCount({ offerCount: 0, pendingDrawOfferById: null })).toBe(1);
    expect(nextDrawOfferCount({ offerCount: 2, pendingDrawOfferById: null })).toBe(3);
    expectDomainError(
      () => assertCanOfferDraw({ offerCount: 3, pendingDrawOfferById: null }),
      "DRAW_OFFER_LIMIT_REACHED",
    );
  });

  it("blocks a second offer while any offer is pending", () => {
    expectDomainError(
      () => assertCanOfferDraw({ offerCount: 1, pendingDrawOfferById: "other-player" }),
      "DRAW_OFFER_ALREADY_PENDING",
    );
    expectDomainError(
      () => assertCanOfferDraw({ offerCount: -1, pendingDrawOfferById: null }),
      "INVALID_DRAW_OFFER_COUNT",
    );
  });

  it("resolves participant color and opponent", () => {
    expect(isMatchParticipant(match, "white-id")).toBe(true);
    expect(isMatchParticipant(match, "outsider")).toBe(false);
    expect(matchColorForPlayer(match, "black-id")).toBe("black");
    expect(opponentIdForPlayer(match, "white-id")).toBe("black-id");
  });

  it("rejects outsiders and malformed matches", () => {
    expectDomainError(() => matchColorForPlayer(match, "outsider"), "PLAYER_NOT_IN_MATCH");
    expectDomainError(
      () => isMatchParticipant({ whitePlayerId: "same", blackPlayerId: "same" }, "same"),
      "PLAYERS_MUST_BE_DISTINCT",
    );
  });
});
