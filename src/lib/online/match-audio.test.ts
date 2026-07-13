import { describe, expect, it } from "vitest";
import { onlineMatchAudioCues } from "@/lib/online/match-audio";
import type {
  OnlineMatchEventSummary,
  OnlineMatchSnapshot,
} from "@/lib/online/types";

describe("onlineMatchAudioCues", () => {
  it("does not announce the initial or repeated snapshot", () => {
    const snapshot = createSnapshot();

    expect(onlineMatchAudioCues(null, snapshot)).toEqual([]);
    expect(onlineMatchAudioCues(snapshot, snapshot)).toEqual([]);
  });

  it.each([
    ["e4", "step"],
    ["exd5", "capture"],
    ["Qh5+", "check"],
    ["Qxh7#", "check"],
  ] as const)("classifies %s as %s", (notation, expected) => {
    const previous = createSnapshot();
    const next = createSnapshot({
      history: [createEvent(1, "MOVE", notation)],
      version: 1,
    });

    expect(onlineMatchAudioCues(previous, next)).toEqual([expected]);
  });

  it("uses the campaign step sound for magic", () => {
    const previous = createSnapshot();
    const next = createSnapshot({
      history: [createEvent(1, "MAGIC", "e2=Q*")],
      version: 1,
    });

    expect(onlineMatchAudioCues(previous, next)).toEqual(["step"]);
  });

  it("ignores non-board events and only announces the newest board event", () => {
    const previous = createSnapshot({
      history: [createEvent(1, "MOVE", "e4")],
      version: 1,
    });
    const next = createSnapshot({
      history: [
        createEvent(1, "MOVE", "e4"),
        createEvent(2, "DRAW_OFFERED", "DRAW_OFFERED"),
        createEvent(3, "MOVE", "Nf6"),
        createEvent(4, "MOVE", "Bxh7+"),
      ],
      version: 4,
    });

    expect(onlineMatchAudioCues(previous, next)).toEqual(["check"]);
  });

  it.each([
    ["white", "WHITE_WIN", "win"],
    ["white", "BLACK_WIN", "defeat"],
    ["black", "BLACK_WIN", "win"],
    ["black", "WHITE_WIN", "defeat"],
  ] as const)(
    "announces %s player result %s as %s",
    (playerColor, outcome, expected) => {
      const previous = createSnapshot({ playerColor });
      const next = createSnapshot({
        playerColor,
        result: {
          finishedAt: "2026-07-13T00:00:00.000Z",
          outcome,
          reason: "SURRENDER",
        },
        status: "FINISHED",
        version: 1,
      });

      expect(onlineMatchAudioCues(previous, next)).toEqual([expected]);
    },
  );

  it("keeps a draw silent after the final move sound", () => {
    const previous = createSnapshot();
    const next = createSnapshot({
      history: [createEvent(1, "MOVE", "Kh8")],
      result: {
        finishedAt: "2026-07-13T00:00:00.000Z",
        outcome: "DRAW",
        reason: "STALEMATE",
      },
      status: "FINISHED",
      version: 1,
    });

    expect(onlineMatchAudioCues(previous, next)).toEqual(["step"]);
  });
});

function createEvent(
  sequence: number,
  type: OnlineMatchEventSummary["type"],
  notation: string,
): OnlineMatchEventSummary {
  return {
    actorId: "player-1",
    createdAt: "2026-07-13T00:00:00.000Z",
    notation,
    sequence,
    type,
  };
}

function createSnapshot(
  overrides: Partial<OnlineMatchSnapshot> = {},
): OnlineMatchSnapshot {
  return {
    clocks: {
      activeColor: "white",
      blackTimeMs: 600_000,
      whiteTimeMs: 600_000,
    },
    draw: {
      offersRemaining: 3,
      offersUsed: 0,
      opponentOffersUsed: 0,
      pendingOfferBy: null,
    },
    fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    history: [],
    id: "match-1",
    magicCoins: { black: 500, white: 500 },
    playerColor: "white",
    players: {
      black: { id: "player-2", name: "Black", onlineRating: 0 },
      white: { id: "player-1", name: "White", onlineRating: 0 },
    },
    rematch: {
      challengeId: null,
      nextMatchId: null,
      state: "NONE",
    },
    result: null,
    serverTime: "2026-07-13T00:00:00.000Z",
    status: "ACTIVE",
    turnColor: "white",
    version: 0,
    ...overrides,
  };
}
