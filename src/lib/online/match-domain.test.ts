import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { OnlineServiceError } from "./errors";
import {
  applyMagicToPosition,
  assertClientRequestId,
  classifyTerminalPosition,
  hasThreefoldRepetition,
  playMoveOnPosition,
  positionFensSinceLastMagic,
  positionKey,
  resolveOnlineRatings,
} from "./match-domain";

function expectServiceError(operation: () => unknown, code: OnlineServiceError["code"]) {
  try {
    operation();
    throw new Error("Expected OnlineServiceError");
  } catch (error) {
    expect(error).toBeInstanceOf(OnlineServiceError);
    expect((error as OnlineServiceError).code).toBe(code);
  }
}

describe("online match domain", () => {
  it("validates idempotency keys", () => {
    expect(() => assertClientRequestId("request-123")).not.toThrow();
    expectServiceError(() => assertClientRequestId("short"), "INVALID_CLIENT_REQUEST_ID");
    expectServiceError(() => assertClientRequestId("unsafe request"), "INVALID_CLIENT_REQUEST_ID");
  });

  it("plays a legal move and rejects an illegal move", () => {
    const played = playMoveOnPosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      { from: "e2", to: "e4" },
    );
    expect(played.notation).toBe("e4");
    expect(played.fen).toContain(" b ");
    expectServiceError(
      () => playMoveOnPosition(played.fen, { from: "e2", to: "e5" }),
      "ILLEGAL_MOVE",
    );
  });

  it("transforms only the active player's pawn and passes the turn", () => {
    const transformed = applyMagicToPosition({
      fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 12 7",
      replacementPiece: "n",
      targetSquare: "e2",
    });
    expect(transformed.fen).toBe("4k3/8/8/8/8/8/4N3/4K3 b - - 0 7");
    expect(transformed.notation).toBe("e2=N*");
    expectServiceError(
      () => applyMagicToPosition({
        fen: "4k3/8/8/8/8/8/4P3/4K3 b - - 0 7",
        replacementPiece: "q",
        targetSquare: "e2",
      }),
      "INVALID_MAGIC_TARGET",
    );
  });

  it("forbids magic while the active king is checked", () => {
    expectServiceError(
      () => applyMagicToPosition({
        fen: "4k3/8/8/8/8/8/4rP2/4K3 w - - 0 1",
        replacementPiece: "q",
        targetSquare: "f2",
      }),
      "PLAYER_IN_CHECK",
    );
  });

  it("uses the first four FEN fields as a repetition key", () => {
    expect(positionKey("8/8/8/8/8/8/8/K6k w - - 0 1"))
      .toBe(positionKey("8/8/8/8/8/8/8/K6k w - - 42 99"));
    expect(hasThreefoldRepetition([
      "8/8/8/8/8/8/8/K6k w - - 0 1",
      "8/8/8/8/8/8/8/K6k b - - 1 1",
      "8/8/8/8/8/8/8/K6k w - - 2 2",
      "8/8/8/8/8/8/8/K6k w - - 4 3",
    ])).toBe(true);
  });

  it("resets the repetition segment after magic", () => {
    const fens = positionFensSinceLastMagic("start w - - 0 1", [
      { type: "MOVE", payload: { fen: "move b - - 0 1" } },
      { type: "MAGIC", payload: { fen: "magic w - - 0 2" } },
      { type: "MOVE", payload: { fen: "after b - - 0 2" } },
    ]);
    expect(fens).toEqual(["magic w - - 0 2", "after b - - 0 2"]);
  });

  it("increments the winner and clamps the loser rating at zero", () => {
    expect(resolveOnlineRatings({ loserRating: 4, winnerRating: 2 })).toEqual({
      loser: { delta: -1, ratingAfter: 3 },
      winner: { delta: 1, ratingAfter: 3 },
    });
    expect(resolveOnlineRatings({ loserRating: 0, winnerRating: 7 })).toEqual({
      loser: { delta: 0, ratingAfter: 0 },
      winner: { delta: 1, ratingAfter: 8 },
    });
  });

  it("classifies checkmate and draw terminals", () => {
    expect(classifyTerminalPosition(
      new Chess("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"),
      [],
    )).toEqual({ outcome: "WHITE_WIN", reason: "CHECKMATE" });
    expect(classifyTerminalPosition(
      new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"),
      [],
    )).toEqual({ outcome: "DRAW", reason: "STALEMATE" });
  });
});
