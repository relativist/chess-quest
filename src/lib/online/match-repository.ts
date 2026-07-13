import { Chess } from "chess.js";
import type { Prisma } from "@/generated/prisma/client";
import { STARTING_FEN } from "@/lib/chess/fen-validation";
import { getMagicUpgradeById } from "@/lib/quest/magic-upgrades";
import {
  assertExpectedVersion,
  matchColorForPlayer,
  toPublicOnlinePlayer,
} from "./domain";
import { OnlineServiceError } from "./errors";
import {
  applyMagicToPosition,
  assertClientRequestId,
  classifyTerminalPosition,
  computeOnlineMatchClocks,
  onlineColorFromFen,
  playMoveOnPosition,
  positionFensSinceLastMagic,
  resolveOnlineRatings,
} from "./match-domain";
import { requireOnlineDatabase } from "./server-auth";
import type {
  FinishOnlineMatchInput,
  OnlineColor,
  OnlineDrawActionInput,
  OnlineMatchFinishReason,
  OnlineMatchResultValue,
  OnlineMatchSnapshot,
  PlayOnlineMoveInput,
  UseOnlineMagicInput,
} from "./types";

const matchSelect = {
  blackDrawOfferCount: true,
  blackMagicCoins: true,
  blackPlayer: {
    select: { displayName: true, id: true, onlineRating: true },
  },
  blackPlayerId: true,
  blackTimeMs: true,
  events: {
    orderBy: { sequence: "asc" as const },
    select: {
      actorId: true,
      clientRequestId: true,
      createdAt: true,
      matchId: true,
      payload: true,
      sequence: true,
      type: true,
    },
  },
  fen: true,
  finishReason: true,
  finishedAt: true,
  id: true,
  pendingDrawOfferById: true,
  rematchChallenges: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    where: { status: { in: ["PENDING", "ACCEPTED"] as const } },
    select: {
      challengedId: true,
      challengerId: true,
      expiresAt: true,
      id: true,
      match: { select: { id: true } },
      status: true,
    },
  },
  ratingAppliedAt: true,
  result: true,
  startedAt: true,
  status: true,
  turnStartedAt: true,
  version: true,
  whiteDrawOfferCount: true,
  whiteMagicCoins: true,
  whitePlayer: {
    select: { displayName: true, id: true, onlineRating: true },
  },
  whitePlayerId: true,
  whiteTimeMs: true,
} satisfies Prisma.OnlineMatchSelect;

type MatchRecord = Prisma.OnlineMatchGetPayload<{ select: typeof matchSelect }>;
type MatchClocks = ReturnType<typeof currentClocks>;
type CommandEventType = "MOVE" | "MAGIC" | "DRAW_OFFERED" | "DRAW_DECLINED"
  | "DRAW_ACCEPTED" | "SURRENDERED";

type FinalizeInput = {
  clocks: MatchClocks;
  event: {
    actorId?: string;
    clientRequestId?: string;
    payload: Prisma.InputJsonValue;
    type: CommandEventType | "TIMED_OUT";
  };
  extraData?: Prisma.OnlineMatchUncheckedUpdateManyInput;
  now: Date;
  outcome: OnlineMatchResultValue;
  reason: OnlineMatchFinishReason;
};

export async function getOnlineMatchSnapshot(
  matchId: string,
  actorId: string,
  now = new Date(),
): Promise<OnlineMatchSnapshot> {
  const prisma = requireOnlineDatabase();

  return prisma.$transaction(async (tx) => {
    let match = await findMatch(tx, matchId);
    assertParticipant(match, actorId);

    if (match.status === "ACTIVE") {
      const clocks = currentClocks(match, now);
      if (clocks.timedOut) {
        match = await finalizeTimeout(tx, match, clocks, now);
      }
    }

    return toSnapshot(match, actorId, now);
  });
}

export async function playOnlineMove(
  matchId: string,
  actorId: string,
  input: PlayOnlineMoveInput,
  now = new Date(),
): Promise<OnlineMatchSnapshot> {
  assertClientRequestId(input.clientRequestId);
  const fingerprint = commandFingerprint("MOVE", {
    from: input.from,
    promotion: input.promotion ?? null,
    to: input.to,
  });
  const prisma = requireOnlineDatabase();

  return prisma.$transaction(async (tx) => {
    const duplicate = await findRequestEvent(tx, input.clientRequestId);
    if (duplicate) {
      return duplicateSnapshot(tx, duplicate, matchId, actorId, "MOVE", fingerprint, now);
    }

    let match = await findMatch(tx, matchId);
    assertParticipant(match, actorId);
    assertActive(match);

    const clocks = currentClocks(match, now);
    if (clocks.timedOut) {
      match = await finalizeTimeout(tx, match, clocks, now);
      return toSnapshot(match, actorId, now);
    }

    assertExpectedVersion(match.version, input.expectedVersion);
    assertActorTurn(match, actorId);

    const played = playMoveOnPosition(match.fen, input);
    const previousFens = positionFensSinceLastMagic(STARTING_FEN, match.events);
    const terminal = classifyTerminalPosition(
      new Chess(played.fen),
      [...previousFens, played.fen],
    );
    const payload = {
      commandFingerprint: fingerprint,
      fen: played.fen,
      from: input.from,
      notation: played.notation,
      promotion: input.promotion ?? null,
      to: input.to,
    };

    if (terminal) {
      match = await finalizeMatch(tx, match, {
        clocks,
        event: {
          actorId,
          clientRequestId: input.clientRequestId,
          payload,
          type: "MOVE",
        },
        extraData: { fen: played.fen, turnStartedAt: now },
        now,
        outcome: terminal.outcome,
        reason: terminal.reason,
      });
      return toSnapshot(match, actorId, now);
    }

    match = await storeActiveEvent(tx, match, {
      actorId,
      clientRequestId: input.clientRequestId,
      clocks,
      data: { fen: played.fen },
      fingerprint,
      now,
      payload,
      type: "MOVE",
    });
    return toSnapshot(match, actorId, now);
  });
}

export async function applyOnlineMagic(
  matchId: string,
  actorId: string,
  input: UseOnlineMagicInput,
  now = new Date(),
): Promise<OnlineMatchSnapshot> {
  assertClientRequestId(input.clientRequestId);
  const upgrade = getMagicUpgradeById(input.magicId);
  if (!upgrade || upgrade.id === "engine_hint" || !upgrade.replacementPiece) {
    throw new OnlineServiceError("INVALID_MAGIC", "This magic is not available online.");
  }

  const fingerprint = commandFingerprint("MAGIC", {
    magicId: input.magicId,
    targetSquare: input.targetSquare,
  });
  const replacementPiece = upgrade.replacementPiece;
  const prisma = requireOnlineDatabase();

  return prisma.$transaction(async (tx) => {
    const duplicate = await findRequestEvent(tx, input.clientRequestId);
    if (duplicate) {
      return duplicateSnapshot(tx, duplicate, matchId, actorId, "MAGIC", fingerprint, now);
    }

    let match = await findMatch(tx, matchId);
    assertParticipant(match, actorId);
    assertActive(match);

    const clocks = currentClocks(match, now);
    if (clocks.timedOut) {
      match = await finalizeTimeout(tx, match, clocks, now);
      return toSnapshot(match, actorId, now);
    }

    assertExpectedVersion(match.version, input.expectedVersion);
    const actorColor = assertActorTurn(match, actorId);
    const availableCoins = actorColor === "white"
      ? match.whiteMagicCoins
      : match.blackMagicCoins;
    if (availableCoins < upgrade.costGold) {
      throw new OnlineServiceError(
        "INSUFFICIENT_MAGIC_COINS",
        "Not enough match magic coins.",
      );
    }

    const transformed = applyMagicToPosition({
      fen: match.fen,
      replacementPiece,
      targetSquare: input.targetSquare,
    });
    const terminal = classifyTerminalPosition(new Chess(transformed.fen), [transformed.fen]);
    const payload = {
      commandFingerprint: fingerprint,
      cost: upgrade.costGold,
      fen: transformed.fen,
      magicId: upgrade.id,
      notation: transformed.notation,
      targetSquare: input.targetSquare,
    };
    const coinData = actorColor === "white"
      ? { whiteMagicCoins: { decrement: upgrade.costGold } }
      : { blackMagicCoins: { decrement: upgrade.costGold } };

    if (terminal) {
      match = await finalizeMatch(tx, match, {
        clocks,
        event: {
          actorId,
          clientRequestId: input.clientRequestId,
          payload,
          type: "MAGIC",
        },
        extraData: { ...coinData, fen: transformed.fen, turnStartedAt: now },
        now,
        outcome: terminal.outcome,
        reason: terminal.reason,
      });
      return toSnapshot(match, actorId, now);
    }

    match = await storeActiveEvent(tx, match, {
      actorId,
      clientRequestId: input.clientRequestId,
      clocks,
      data: { ...coinData, fen: transformed.fen },
      fingerprint,
      now,
      payload,
      type: "MAGIC",
    });
    return toSnapshot(match, actorId, now);
  });
}

export async function surrenderOnlineMatch(
  matchId: string,
  actorId: string,
  input: FinishOnlineMatchInput,
  now = new Date(),
): Promise<OnlineMatchSnapshot> {
  assertClientRequestId(input.clientRequestId);
  const fingerprint = commandFingerprint("SURRENDERED", {});
  const prisma = requireOnlineDatabase();

  return prisma.$transaction(async (tx) => {
    const duplicate = await findRequestEvent(tx, input.clientRequestId);
    if (duplicate) {
      return duplicateSnapshot(
        tx,
        duplicate,
        matchId,
        actorId,
        "SURRENDERED",
        fingerprint,
        now,
      );
    }

    let match = await findMatch(tx, matchId);
    assertParticipant(match, actorId);
    assertActive(match);
    const clocks = currentClocks(match, now);
    if (clocks.timedOut) {
      match = await finalizeTimeout(tx, match, clocks, now);
      return toSnapshot(match, actorId, now);
    }

    assertExpectedVersion(match.version, input.expectedVersion);
    const actorColor = matchColorForPlayer(match, actorId);
    const outcome = actorColor === "white" ? "BLACK_WIN" : "WHITE_WIN";
    match = await finalizeMatch(tx, match, {
      clocks,
      event: {
        actorId,
        clientRequestId: input.clientRequestId,
        payload: { commandFingerprint: fingerprint, surrenderedColor: actorColor },
        type: "SURRENDERED",
      },
      now,
      outcome,
      reason: "SURRENDER",
    });
    return toSnapshot(match, actorId, now);
  });
}

export async function handleOnlineDrawAction(
  matchId: string,
  actorId: string,
  input: OnlineDrawActionInput,
  now = new Date(),
): Promise<OnlineMatchSnapshot> {
  assertClientRequestId(input.clientRequestId);
  if (!["offer", "accept", "decline"].includes(input.action)) {
    throw new OnlineServiceError("INVALID_DRAW_ACTION", "Unknown draw action.");
  }
  const eventType = drawEventType(input.action);
  const fingerprint = commandFingerprint(eventType, { action: input.action });
  const prisma = requireOnlineDatabase();

  return prisma.$transaction(async (tx) => {
    const duplicate = await findRequestEvent(tx, input.clientRequestId);
    if (duplicate) {
      return duplicateSnapshot(tx, duplicate, matchId, actorId, eventType, fingerprint, now);
    }

    let match = await findMatch(tx, matchId);
    assertParticipant(match, actorId);
    assertActive(match);
    const clocks = currentClocks(match, now);
    if (clocks.timedOut) {
      match = await finalizeTimeout(tx, match, clocks, now);
      return toSnapshot(match, actorId, now);
    }

    assertExpectedVersion(match.version, input.expectedVersion);
    const actorColor = matchColorForPlayer(match, actorId);

    if (input.action === "offer") {
      if (match.pendingDrawOfferById) {
        throw new OnlineServiceError(
          "DRAW_OFFER_ALREADY_PENDING",
          "A draw offer is already pending.",
        );
      }
      const offersUsed = actorColor === "white"
        ? match.whiteDrawOfferCount
        : match.blackDrawOfferCount;
      if (offersUsed >= 3) {
        throw new OnlineServiceError(
          "DRAW_OFFER_LIMIT_REACHED",
          "A player can offer a draw at most three times.",
        );
      }
      const countData = actorColor === "white"
        ? { whiteDrawOfferCount: { increment: 1 } }
        : { blackDrawOfferCount: { increment: 1 } };
      match = await storeActiveEvent(tx, match, {
        actorId,
        clientRequestId: input.clientRequestId,
        clocks,
        data: { ...countData, pendingDrawOfferById: actorId },
        fingerprint,
        now,
        payload: { commandFingerprint: fingerprint, offeredBy: actorColor },
        type: "DRAW_OFFERED",
      });
      return toSnapshot(match, actorId, now);
    }

    assertDrawResponseAllowed(match, actorId);
    if (input.action === "accept") {
      match = await finalizeMatch(tx, match, {
        clocks,
        event: {
          actorId,
          clientRequestId: input.clientRequestId,
          payload: { commandFingerprint: fingerprint },
          type: "DRAW_ACCEPTED",
        },
        now,
        outcome: "DRAW",
        reason: "DRAW_AGREEMENT",
      });
      return toSnapshot(match, actorId, now);
    }

    match = await storeActiveEvent(tx, match, {
      actorId,
      clientRequestId: input.clientRequestId,
      clocks,
      data: { pendingDrawOfferById: null },
      fingerprint,
      now,
      payload: { commandFingerprint: fingerprint },
      type: "DRAW_DECLINED",
    });
    return toSnapshot(match, actorId, now);
  });
}

async function findMatch(tx: Prisma.TransactionClient, matchId: string): Promise<MatchRecord> {
  const match = await tx.onlineMatch.findUnique({
    where: { id: matchId },
    select: matchSelect,
  });
  if (!match) {
    throw new OnlineServiceError("MATCH_NOT_FOUND", "Online match does not exist.");
  }
  return match;
}

function assertParticipant(match: MatchRecord, actorId: string): void {
  if (match.whitePlayerId !== actorId && match.blackPlayerId !== actorId) {
    throw new OnlineServiceError(
      "PLAYER_NOT_IN_MATCH",
      "Player is not a participant of this match.",
    );
  }
}

function assertActive(match: MatchRecord): void {
  if (match.status !== "ACTIVE") {
    throw new OnlineServiceError("MATCH_FINISHED", "Online match is already finished.");
  }
}

function assertActorTurn(match: MatchRecord, actorId: string): OnlineColor {
  const actorColor = matchColorForPlayer(match, actorId);
  if (onlineColorFromFen(match.fen) !== actorColor) {
    throw new OnlineServiceError("NOT_PLAYER_TURN", "It is the opponent's turn.");
  }
  return actorColor;
}

function assertDrawResponseAllowed(match: MatchRecord, actorId: string): void {
  if (!match.pendingDrawOfferById) {
    throw new OnlineServiceError("DRAW_OFFER_NOT_PENDING", "There is no pending draw offer.");
  }
  if (match.pendingDrawOfferById === actorId) {
    throw new OnlineServiceError(
      "DRAW_RESPONSE_FORBIDDEN",
      "A player cannot respond to their own draw offer.",
    );
  }
}

function currentClocks(match: MatchRecord, now: Date) {
  return computeOnlineMatchClocks({
    clocks: {
      blackTimeMs: match.blackTimeMs,
      whiteTimeMs: match.whiteTimeMs,
    },
    fen: match.fen,
    now,
    status: match.status,
    turnStartedAt: match.turnStartedAt,
  });
}

async function finalizeTimeout(
  tx: Prisma.TransactionClient,
  match: MatchRecord,
  clocks: MatchClocks,
  now: Date,
): Promise<MatchRecord> {
  if (!clocks.activeColor) return match;
  const outcome = clocks.activeColor === "white" ? "BLACK_WIN" : "WHITE_WIN";
  return finalizeMatch(tx, match, {
    clocks,
    event: {
      payload: { outcome, timedOutColor: clocks.activeColor },
      type: "TIMED_OUT",
    },
    now,
    outcome,
    reason: "TIMEOUT",
  });
}

async function finalizeMatch(
  tx: Prisma.TransactionClient,
  match: MatchRecord,
  input: FinalizeInput,
): Promise<MatchRecord> {
  const nextVersion = match.version + 1;
  const update = await tx.onlineMatch.updateMany({
    where: { id: match.id, status: "ACTIVE", version: match.version },
    data: {
      ...input.extraData,
      blackTimeMs: input.clocks.blackTimeMs,
      finishedAt: input.now,
      finishReason: input.reason,
      pendingDrawOfferById: null,
      ratingAppliedAt: input.now,
      result: input.outcome,
      status: "FINISHED",
      turnStartedAt: input.now,
      version: nextVersion,
      whiteTimeMs: input.clocks.whiteTimeMs,
    },
  });

  if (update.count !== 1) {
    if (input.event.clientRequestId && input.event.actorId) {
      const duplicate = await findRequestEvent(tx, input.event.clientRequestId);
      if (duplicate) {
        return duplicateMatch(
          tx,
          duplicate,
          match.id,
          input.event.actorId,
          input.event.type as CommandEventType,
          eventFingerprint(input.event.payload) ?? "",
        );
      }
    }
    return findMatch(tx, match.id);
  }

  await tx.onlineMatchEvent.create({
    data: {
      actorId: input.event.actorId,
      clientRequestId: input.event.clientRequestId,
      matchId: match.id,
      payload: input.event.payload,
      sequence: nextVersion,
      type: input.event.type,
    },
  });

  if (input.outcome !== "DRAW") {
    await applyRatingResult(tx, match, input.outcome);
  }
  await releasePlayers(tx, match.id);
  return findMatch(tx, match.id);
}

async function applyRatingResult(
  tx: Prisma.TransactionClient,
  match: MatchRecord,
  outcome: Exclude<OnlineMatchResultValue, "DRAW">,
): Promise<void> {
  const winner = outcome === "WHITE_WIN" ? match.whitePlayer : match.blackPlayer;
  const loser = outcome === "WHITE_WIN" ? match.blackPlayer : match.whitePlayer;
  const resolution = resolveOnlineRatings({
    loserRating: loser.onlineRating,
    winnerRating: winner.onlineRating,
  });

  await tx.user.update({
    where: { id: winner.id },
    data: { onlineRating: resolution.winner.ratingAfter },
  });
  await tx.user.update({
    where: { id: loser.id },
    data: { onlineRating: resolution.loser.ratingAfter },
  });
  await tx.onlineRatingChange.createMany({
    data: [
      {
        delta: resolution.winner.delta,
        matchId: match.id,
        ratingAfter: resolution.winner.ratingAfter,
        userId: winner.id,
      },
      {
        delta: resolution.loser.delta,
        matchId: match.id,
        ratingAfter: resolution.loser.ratingAfter,
        userId: loser.id,
      },
    ],
  });
}

async function storeActiveEvent(
  tx: Prisma.TransactionClient,
  match: MatchRecord,
  input: {
    actorId: string;
    clientRequestId: string;
    clocks: MatchClocks;
    data: Prisma.OnlineMatchUncheckedUpdateManyInput;
    fingerprint: string;
    now: Date;
    payload: Prisma.InputJsonValue;
    type: CommandEventType;
  },
): Promise<MatchRecord> {
  const nextVersion = match.version + 1;
  const update = await tx.onlineMatch.updateMany({
    where: { id: match.id, status: "ACTIVE", version: match.version },
    data: {
      ...input.data,
      blackTimeMs: input.clocks.blackTimeMs,
      turnStartedAt: input.now,
      version: nextVersion,
      whiteTimeMs: input.clocks.whiteTimeMs,
    },
  });

  if (update.count !== 1) {
    const duplicate = await findRequestEvent(tx, input.clientRequestId);
    if (duplicate) {
      return duplicateMatch(
        tx,
        duplicate,
        match.id,
        input.actorId,
        input.type,
        input.fingerprint,
      );
    }
    throw new OnlineServiceError(
      "VERSION_CONFLICT",
      "Match changed before the command could be stored.",
    );
  }

  await tx.onlineMatchEvent.create({
    data: {
      actorId: input.actorId,
      clientRequestId: input.clientRequestId,
      matchId: match.id,
      payload: input.payload,
      sequence: nextVersion,
      type: input.type,
    },
  });
  return findMatch(tx, match.id);
}

async function releasePlayers(tx: Prisma.TransactionClient, matchId: string) {
  await tx.onlinePlayerState.updateMany({
    where: { activeMatchId: matchId },
    data: { activeMatchId: null },
  });
}

async function findRequestEvent(tx: Prisma.TransactionClient, clientRequestId: string) {
  return tx.onlineMatchEvent.findUnique({
    where: { clientRequestId },
    select: { actorId: true, matchId: true, payload: true, type: true },
  });
}

async function duplicateSnapshot(
  tx: Prisma.TransactionClient,
  event: NonNullable<Awaited<ReturnType<typeof findRequestEvent>>>,
  matchId: string,
  actorId: string,
  type: CommandEventType,
  fingerprint: string,
  now: Date,
): Promise<OnlineMatchSnapshot> {
  const match = await duplicateMatch(tx, event, matchId, actorId, type, fingerprint);
  return toSnapshot(match, actorId, now);
}

async function duplicateMatch(
  tx: Prisma.TransactionClient,
  event: NonNullable<Awaited<ReturnType<typeof findRequestEvent>>>,
  matchId: string,
  actorId: string,
  type: CommandEventType,
  fingerprint: string,
): Promise<MatchRecord> {
  if (
    event.matchId !== matchId
    || event.actorId !== actorId
    || event.type !== type
    || eventFingerprint(event.payload) !== fingerprint
  ) {
    throw new OnlineServiceError(
      "REQUEST_ID_REUSED",
      "clientRequestId was already used for another command.",
    );
  }
  const match = await findMatch(tx, matchId);
  assertParticipant(match, actorId);
  return match;
}

function eventFingerprint(payload: unknown): string | null {
  if (
    typeof payload === "object"
    && payload !== null
    && "commandFingerprint" in payload
    && typeof payload.commandFingerprint === "string"
  ) {
    return payload.commandFingerprint;
  }
  return null;
}

function commandFingerprint(type: CommandEventType, payload: object): string {
  return type + ":" + JSON.stringify(payload);
}

function drawEventType(action: OnlineDrawActionInput["action"]): CommandEventType {
  if (action === "offer") return "DRAW_OFFERED";
  if (action === "accept") return "DRAW_ACCEPTED";
  return "DRAW_DECLINED";
}

function toSnapshot(match: MatchRecord, actorId: string, now: Date): OnlineMatchSnapshot {
  const playerColor = matchColorForPlayer(match, actorId);
  const clocks = currentClocks(match, now);
  const offersUsed = playerColor === "white"
    ? match.whiteDrawOfferCount
    : match.blackDrawOfferCount;
  const opponentOffersUsed = playerColor === "white"
    ? match.blackDrawOfferCount
    : match.whiteDrawOfferCount;

  return {
    clocks: {
      activeColor: match.status === "ACTIVE" ? clocks.activeColor : null,
      blackTimeMs: clocks.blackTimeMs,
      whiteTimeMs: clocks.whiteTimeMs,
    },
    draw: {
      offersRemaining: Math.max(0, 3 - offersUsed),
      offersUsed,
      opponentOffersUsed,
      pendingOfferBy: match.pendingDrawOfferById === null
        ? null
        : match.pendingDrawOfferById === actorId ? "self" : "opponent",
    },
    fen: match.fen,
    history: match.events.map((event) => ({
      actorId: event.actorId,
      createdAt: event.createdAt.toISOString(),
      notation: eventNotation(event.payload, event.type),
      sequence: event.sequence,
      type: event.type,
    })),
    id: match.id,
    magicCoins: {
      black: match.blackMagicCoins,
      white: match.whiteMagicCoins,
    },
    playerColor,
    rematch: rematchSnapshot(match, actorId, now),
    players: {
      black: toPublicOnlinePlayer({
        id: match.blackPlayer.id,
        name: match.blackPlayer.displayName,
        onlineRating: match.blackPlayer.onlineRating,
      }),
      white: toPublicOnlinePlayer({
        id: match.whitePlayer.id,
        name: match.whitePlayer.displayName,
        onlineRating: match.whitePlayer.onlineRating,
      }),
    },
    result: match.result && match.finishReason && match.finishedAt
      ? {
          finishedAt: match.finishedAt.toISOString(),
          outcome: match.result,
          reason: match.finishReason,
        }
      : null,
    serverTime: now.toISOString(),
    status: match.status,
    turnColor: onlineColorFromFen(match.fen),
    version: match.version,
  };
}

function eventNotation(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object"
    && payload !== null
    && "notation" in payload
    && typeof payload.notation === "string"
  ) {
    return payload.notation;
  }
  return fallback;
}

function rematchSnapshot(match: MatchRecord, actorId: string, now: Date): OnlineMatchSnapshot["rematch"] {
  const challenge = match.rematchChallenges[0];
  if (!challenge || (challenge.status === "PENDING" && challenge.expiresAt.getTime() <= now.getTime())) {
    return { challengeId: null, nextMatchId: null, state: "NONE" };
  }
  if (challenge.status === "ACCEPTED" && challenge.match) {
    return { challengeId: challenge.id, nextMatchId: challenge.match.id, state: "MATCH_CREATED" };
  }
  return {
    challengeId: challenge.id,
    nextMatchId: null,
    state: challenge.challengerId === actorId ? "OFFERED_BY_YOU" : "OFFERED_BY_OPPONENT",
  };
}
