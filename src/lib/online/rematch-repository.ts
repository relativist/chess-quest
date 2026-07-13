import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { STARTING_FEN } from "@/lib/chess/fen-validation";
import { ONLINE_CHALLENGE_TTL_MS } from "./constants";
import { activeChallengeKey, assignRandomColors } from "./domain";
import { OnlineServiceError } from "./errors";
import { getOnlineMatchSnapshot } from "./match-repository";
import { requireOnlineDatabase } from "./server-auth";
import type { OnlineRematchActionInput } from "./types";

type SourceMatch = {
  blackPlayerId: string;
  status: "ACTIVE" | "FINISHED";
  whitePlayerId: string;
};

export async function handleOnlineRematchAction(
  sourceMatchId: string,
  actorId: string,
  input: OnlineRematchActionInput,
  now = new Date(),
) {
  if (input.action === "offer") {
    await offerRematch(sourceMatchId, actorId, now);
    return { snapshot: await getOnlineMatchSnapshot(sourceMatchId, actorId, now) };
  }
  if (!input.challengeId) {
    throw new OnlineServiceError(
      "REMATCH_CHALLENGE_REQUIRED",
      "Rematch challenge id is required.",
    );
  }
  if (input.action === "accept") {
    return {
      nextMatchId: await acceptRematch(
        sourceMatchId,
        input.challengeId,
        actorId,
        now,
      ),
    };
  }

  await declineRematch(sourceMatchId, input.challengeId, actorId, now);
  return { snapshot: await getOnlineMatchSnapshot(sourceMatchId, actorId, now) };
}

async function offerRematch(sourceMatchId: string, actorId: string, now: Date) {
  const prisma = requireOnlineDatabase();
  try {
    return await prisma.$transaction(async (tx) => {
      await expireRematches(tx, now);
      const source = await getSourceMatch(tx, sourceMatchId);
      const opponentId = rematchOpponent(source, actorId);
      assertFinished(source);

      const existing = await tx.onlineChallenge.findFirst({
        where: {
          rematchOfMatchId: sourceMatchId,
          status: "PENDING",
          OR: [
            { challengerId: actorId, challengedId: opponentId },
            { challengerId: opponentId, challengedId: actorId },
          ],
        },
        select: { challengedId: true, challengerId: true, id: true },
      });
      if (existing) {
        if (existing.challengerId === actorId) return existing;
        throw new OnlineServiceError(
          "REMATCH_ALREADY_PENDING",
          "Opponent already offered a rematch.",
        );
      }

      await assertPlayersUnclaimed(tx, [actorId, opponentId]);
      return tx.onlineChallenge.create({
        data: {
          activeKey: activeChallengeKey(actorId, opponentId),
          challengedId: opponentId,
          challengerId: actorId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + ONLINE_CHALLENGE_TTL_MS),
          rematchOfMatchId: sourceMatchId,
        },
        select: { challengedId: true, challengerId: true, id: true },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new OnlineServiceError(
        "REMATCH_ALREADY_PENDING",
        "A challenge between these players is already pending.",
      );
    }
    throw error;
  }
}

async function acceptRematch(
  sourceMatchId: string,
  challengeId: string,
  actorId: string,
  now: Date,
) {
  const prisma = requireOnlineDatabase();
  return prisma.$transaction(async (tx) => {
    await expireRematches(tx, now);
    const source = await getSourceMatch(tx, sourceMatchId);
    const opponentId = rematchOpponent(source, actorId);
    assertFinished(source);

    const challenge = await tx.onlineChallenge.findUnique({
      where: { id: challengeId },
      select: {
        challengedId: true,
        challengerId: true,
        expiresAt: true,
        id: true,
        match: { select: { id: true } },
        rematchOfMatchId: true,
        status: true,
      },
    });
    if (!challenge || challenge.rematchOfMatchId !== sourceMatchId) {
      throw new OnlineServiceError("REMATCH_NOT_FOUND", "Rematch offer does not exist.");
    }
    if (challenge.challengedId !== actorId || challenge.challengerId !== opponentId) {
      throw new OnlineServiceError(
        "REMATCH_RESPONSE_FORBIDDEN",
        "Only the challenged player can accept this rematch.",
      );
    }
    if (challenge.status === "ACCEPTED" && challenge.match) {
      return challenge.match.id;
    }
    if (challenge.status !== "PENDING" || challenge.expiresAt.getTime() <= now.getTime()) {
      throw new OnlineServiceError("REMATCH_NOT_PENDING", "Rematch offer is no longer pending.");
    }

    const playerIds = [challenge.challengerId, challenge.challengedId];
    await assertPlayersUnclaimed(tx, playerIds);
    const transition = await tx.onlineChallenge.updateMany({
      where: { id: challenge.id, status: "PENDING", expiresAt: { gt: now } },
      data: { activeKey: null, respondedAt: now, status: "ACCEPTED" },
    });
    if (transition.count !== 1) {
      throw new OnlineServiceError("REMATCH_NOT_PENDING", "Rematch offer was already handled.");
    }

    const colors = assignRandomColors(
      challenge.challengerId,
      challenge.challengedId,
      () => randomInt(2) / 2,
    );
    const match = await tx.onlineMatch.create({
      data: {
        blackPlayerId: colors.blackPlayerId,
        challengeId: challenge.id,
        fen: STARTING_FEN,
        startedAt: now,
        turnStartedAt: now,
        whitePlayerId: colors.whitePlayerId,
      },
      select: { id: true },
    });
    const claimed = await tx.onlinePlayerState.updateMany({
      where: { activeMatchId: null, userId: { in: playerIds } },
      data: { activeMatchId: match.id },
    });
    if (claimed.count !== 2) {
      throw new OnlineServiceError(
        "PLAYER_NOT_AVAILABLE",
        "Another match already claimed one of the players.",
      );
    }

    await tx.onlineChallenge.updateMany({
      where: {
        id: { not: challenge.id },
        status: "PENDING",
        OR: [
          { challengerId: { in: playerIds } },
          { challengedId: { in: playerIds } },
        ],
      },
      data: { activeKey: null, respondedAt: now, status: "CANCELED" },
    });
    return match.id;
  });
}

async function declineRematch(
  sourceMatchId: string,
  challengeId: string,
  actorId: string,
  now: Date,
) {
  const prisma = requireOnlineDatabase();
  await prisma.$transaction(async (tx) => {
    const source = await getSourceMatch(tx, sourceMatchId);
    const opponentId = rematchOpponent(source, actorId);
    assertFinished(source);
    const result = await tx.onlineChallenge.updateMany({
      where: {
        challengedId: actorId,
        challengerId: opponentId,
        id: challengeId,
        rematchOfMatchId: sourceMatchId,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      data: { activeKey: null, respondedAt: now, status: "DECLINED" },
    });
    if (result.count !== 1) {
      throw new OnlineServiceError(
        "REMATCH_NOT_PENDING",
        "Rematch offer is no longer pending.",
      );
    }
  });
}

async function getSourceMatch(
  tx: Prisma.TransactionClient,
  sourceMatchId: string,
): Promise<SourceMatch> {
  const match = await tx.onlineMatch.findUnique({
    where: { id: sourceMatchId },
    select: { blackPlayerId: true, status: true, whitePlayerId: true },
  });
  if (!match) {
    throw new OnlineServiceError("MATCH_NOT_FOUND", "Online match does not exist.");
  }
  return match;
}

function assertFinished(match: SourceMatch) {
  if (match.status !== "FINISHED") {
    throw new OnlineServiceError(
      "REMATCH_MATCH_NOT_FINISHED",
      "Rematch is available only after the match finishes.",
    );
  }
}

function rematchOpponent(match: SourceMatch, actorId: string) {
  if (match.whitePlayerId === actorId) return match.blackPlayerId;
  if (match.blackPlayerId === actorId) return match.whitePlayerId;
  throw new OnlineServiceError(
    "PLAYER_NOT_IN_MATCH",
    "Player is not a participant of the source match.",
  );
}

async function assertPlayersUnclaimed(
  tx: Prisma.TransactionClient,
  playerIds: string[],
) {
  const states = await tx.onlinePlayerState.findMany({
    where: { activeMatchId: null, userId: { in: playerIds } },
    select: { userId: true },
  });
  if (states.length !== 2) {
    throw new OnlineServiceError(
      "PLAYER_NOT_AVAILABLE",
      "Both players must be free for a rematch.",
    );
  }
}

async function expireRematches(tx: Prisma.TransactionClient, now: Date) {
  await tx.onlineChallenge.updateMany({
    where: {
      expiresAt: { lte: now },
      rematchOfMatchId: { not: null },
      status: "PENDING",
    },
    data: { activeKey: null, respondedAt: now, status: "EXPIRED" },
  });
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2002"
  );
}
