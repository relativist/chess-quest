import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { debitActiveClock } from "./domain";
import { OnlineServiceError } from "./errors";
import type {
  OnlineColor,
  OnlineMatchClocks,
  OnlineMatchFinishReason,
  OnlineMatchResultValue,
} from "./types";

export type MatchTerminalResult = {
  outcome: OnlineMatchResultValue;
  reason: OnlineMatchFinishReason;
};

export type StoredMatchEventLike = {
  payload: unknown;
  type: string;
};

export type OnlineRatingResolution = {
  loser: { delta: -1 | 0; ratingAfter: number };
  winner: { delta: 1; ratingAfter: number };
};

export function resolveOnlineRatings(input: {
  loserRating: number;
  winnerRating: number;
}): OnlineRatingResolution {
  const loserRatingAfter = Math.max(0, input.loserRating - 1);
  return {
    loser: {
      delta: loserRatingAfter === input.loserRating ? 0 : -1,
      ratingAfter: loserRatingAfter,
    },
    winner: { delta: 1, ratingAfter: input.winnerRating + 1 },
  };
}

export function onlineColorFromFen(fen: string): OnlineColor {
  const side = fen.trim().split(/\s+/)[1];
  if (side === "w") return "white";
  if (side === "b") return "black";
  throw new OnlineServiceError("ILLEGAL_MOVE", "Match contains an invalid FEN side to move.");
}

export function computeOnlineMatchClocks(input: {
  clocks: OnlineMatchClocks;
  fen: string;
  now: Date;
  status: "ACTIVE" | "FINISHED";
  turnStartedAt: Date;
}): OnlineMatchClocks & { activeColor: OnlineColor | null; timedOut: boolean } {
  if (input.status === "FINISHED") {
    return { ...input.clocks, activeColor: null, timedOut: false };
  }
  const debited = debitActiveClock({
    clocks: input.clocks,
    fen: input.fen,
    now: input.now,
    turnStartedAt: input.turnStartedAt,
  });
  return {
    activeColor: debited.activeColor,
    blackTimeMs: debited.blackTimeMs,
    timedOut: debited.timedOut,
    whiteTimeMs: debited.whiteTimeMs,
  };
}

export function assertClientRequestId(clientRequestId: string): void {
  if (
    typeof clientRequestId !== "string"
    || clientRequestId.length < 8
    || clientRequestId.length > 128
    || !/^[A-Za-z0-9._:-]+$/.test(clientRequestId)
  ) {
    throw new OnlineServiceError(
      "INVALID_CLIENT_REQUEST_ID",
      "clientRequestId must contain 8-128 safe characters.",
    );
  }
}

export function positionKey(fen: string): string {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new OnlineServiceError("ILLEGAL_MOVE", "Event contains invalid FEN.");
  }
  return fields.slice(0, 4).join(" ");
}

export function hasThreefoldRepetition(fens: readonly string[]): boolean {
  const counts = new Map<string, number>();
  for (const fen of fens) {
    const key = positionKey(fen);
    const count = (counts.get(key) ?? 0) + 1;
    if (count >= 3) return true;
    counts.set(key, count);
  }
  return false;
}

export function positionFensSinceLastMagic(
  startingFen: string,
  events: readonly StoredMatchEventLike[],
): string[] {
  let fens = [startingFen];
  for (const event of events) {
    const resultingFen = eventResultingFen(event.payload);
    if (!resultingFen) continue;
    if (event.type === "MAGIC") fens = [resultingFen];
    else if (event.type === "MOVE") fens.push(resultingFen);
  }
  return fens;
}

export function eventResultingFen(payload: unknown): string | null {
  if (
    typeof payload === "object"
    && payload !== null
    && "fen" in payload
    && typeof payload.fen === "string"
  ) {
    return payload.fen;
  }
  return null;
}

export function classifyTerminalPosition(
  chess: Chess,
  repetitionFens: readonly string[],
): MatchTerminalResult | null {
  if (chess.isCheckmate()) {
    return {
      outcome: chess.turn() === "w" ? "BLACK_WIN" : "WHITE_WIN",
      reason: "CHECKMATE",
    };
  }
  if (chess.isStalemate()) return { outcome: "DRAW", reason: "STALEMATE" };
  if (chess.isInsufficientMaterial()) {
    return { outcome: "DRAW", reason: "INSUFFICIENT_MATERIAL" };
  }
  const halfmove = Number(chess.fen().split(/\s+/)[4]);
  if (Number.isInteger(halfmove) && halfmove >= 100) {
    return { outcome: "DRAW", reason: "FIFTY_MOVE_RULE" };
  }
  if (hasThreefoldRepetition(repetitionFens)) {
    return { outcome: "DRAW", reason: "THREEFOLD_REPETITION" };
  }
  return null;
}

export function playMoveOnPosition(
  fen: string,
  input: { from: string; promotion?: "b" | "n" | "q" | "r"; to: string },
): { fen: string; notation: string } {
  const chess = new Chess(fen);
  try {
    const move = chess.move({
      from: input.from as Square,
      promotion: input.promotion,
      to: input.to as Square,
    });
    return { fen: chess.fen(), notation: move.san };
  } catch {
    throw new OnlineServiceError("ILLEGAL_MOVE", "Move is not legal in the current position.");
  }
}

export function applyMagicToPosition(input: {
  fen: string;
  replacementPiece: Extract<PieceSymbol, "b" | "n" | "q" | "r">;
  targetSquare: string;
}): { fen: string; notation: string } {
  const chess = new Chess(input.fen);
  if (chess.isCheck()) {
    throw new OnlineServiceError("PLAYER_IN_CHECK", "Magic cannot be used while the king is in check.");
  }

  const square = input.targetSquare as Square;
  const target = chess.get(square);
  const turn = chess.turn();
  if (!target || target.type !== "p" || target.color !== turn) {
    throw new OnlineServiceError(
      "INVALID_MAGIC_TARGET",
      "Magic target must be a pawn belonging to the player whose turn it is.",
    );
  }

  if (!chess.put({ color: turn as Color, type: input.replacementPiece }, square)) {
    throw new OnlineServiceError("INVALID_MAGIC_TARGET", "Magic target square is invalid.");
  }

  const fields = chess.fen().split(/\s+/);
  const nextTurn = turn === "w" ? "b" : "w";
  const fullmove = Number(fields[5]) + (turn === "b" ? 1 : 0);
  const transformedFen = [fields[0], nextTurn, fields[2], "-", "0", String(fullmove)].join(" ");

  try {
    const validated = new Chess(transformedFen);
    return {
      fen: validated.fen(),
      notation: `${input.targetSquare}=${input.replacementPiece.toUpperCase()}*`,
    };
  } catch {
    throw new OnlineServiceError("INVALID_MAGIC_TARGET", "Magic produced an invalid position.");
  }
}
