import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { STARTING_FEN } from "@/lib/chess/fen-validation";
import {
  ONLINE_CHALLENGE_TTL_MS,
  ONLINE_PRESENCE_TTL_MS,
} from "@/lib/online/constants";
import {
  activeChallengeKey,
  assignRandomColors,
  toPublicOnlinePlayer,
} from "@/lib/online/domain";
import { OnlineServiceError } from "@/lib/online/errors";
import { requireOnlineDatabase } from "@/lib/online/server-auth";
import type {
  OnlineChallengeSummary,
  OnlineLobbySnapshot,
} from "@/lib/online/types";

export async function heartbeatOnlinePresence(userId: string, now = new Date()) {
  const prisma = requireOnlineDatabase();

  return prisma.onlinePlayerState.upsert({
    where: { userId },
    create: { lastSeenAt: now, userId },
    update: { lastSeenAt: now },
    select: { activeMatchId: true, lastSeenAt: true, userId: true },
  });
}

export async function getOnlineLobbySnapshot(
  currentUserId: string,
  now = new Date(),
): Promise<OnlineLobbySnapshot> {
  const prisma = requireOnlineDatabase();
  const cutoff = new Date(now.getTime() - ONLINE_PRESENCE_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await expirePendingChallenges(tx, now);

    const currentState = await tx.onlinePlayerState.findUnique({
      where: { userId: currentUserId },
      select: { activeMatchId: true },
    });
    const states = await tx.onlinePlayerState.findMany({
      where: {
        activeMatchId: null,
        lastSeenAt: { gt: cutoff },
        userId: { not: currentUserId },
        user: { role: "PLAYER" },
      },
      select: {
        user: {
          select: { displayName: true, id: true, onlineRating: true },
        },
      },
    });
    const challenges = await tx.onlineChallenge.findMany({
      where: {
        expiresAt: { gt: now },
        status: "PENDING",
        OR: [
          { challengerId: currentUserId },
          { challengedId: currentUserId },
        ],
      },
      select: {
        challenged: {
          select: { displayName: true, id: true, onlineRating: true },
        },
        challengedId: true,
        challenger: {
          select: { displayName: true, id: true, onlineRating: true },
        },
        challengerId: true,
        expiresAt: true,
        id: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const incomingChallenges: OnlineChallengeSummary[] = [];
    const outgoingChallenges: OnlineChallengeSummary[] = [];
    for (const challenge of challenges) {
      const incoming = challenge.challengedId === currentUserId;
      const summary: OnlineChallengeSummary = {
        expiresAt: challenge.expiresAt.toISOString(),
        id: challenge.id,
        player: toPublicOnlinePlayer({
          id: incoming ? challenge.challenger.id : challenge.challenged.id,
          name: incoming
            ? challenge.challenger.displayName
            : challenge.challenged.displayName,
          onlineRating: incoming
            ? challenge.challenger.onlineRating
            : challenge.challenged.onlineRating,
        }),
      };
      (incoming ? incomingChallenges : outgoingChallenges).push(summary);
    }

    return {
      activeMatchId: currentState?.activeMatchId ?? null,
      incomingChallenges,
      outgoingChallenges,
      players: states
        .map(({ user }) => toPublicOnlinePlayer({
          id: user.id,
          name: user.displayName,
          onlineRating: user.onlineRating,
        }))
        .sort((left, right) =>
          right.onlineRating - left.onlineRating
          || left.name.localeCompare(right.name, "ru")
        ),
      serverTime: now.toISOString(),
    };
  });
}

export async function createOnlineChallenge(
  challengerId: string,
  challengedId: string,
  now = new Date(),
) {
  const prisma = requireOnlineDatabase();
  const activeKey = activeChallengeKey(challengerId, challengedId);
  const cutoff = new Date(now.getTime() - ONLINE_PRESENCE_TTL_MS);
  const expiresAt = new Date(now.getTime() + ONLINE_CHALLENGE_TTL_MS);

  try {
    return await prisma.$transaction(async (tx) => {
      await expirePendingChallenges(tx, now);
      const availablePlayers = await tx.onlinePlayerState.findMany({
        where: {
          activeMatchId: null,
          lastSeenAt: { gt: cutoff },
          userId: { in: [challengerId, challengedId] },
          user: { role: "PLAYER" },
        },
        select: { userId: true },
      });

      if (availablePlayers.length !== 2) {
        throw new OnlineServiceError(
          "PLAYER_NOT_AVAILABLE",
          "Both players must be online and available.",
        );
      }

      return tx.onlineChallenge.create({
        data: {
          activeKey,
          challengedId,
          challengerId,
          createdAt: now,
          expiresAt,
        },
        select: { expiresAt: true, id: true, status: true },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new OnlineServiceError(
        "CHALLENGE_ALREADY_PENDING",
        "A pending challenge already exists for these players.",
      );
    }
    throw error;
  }
}

export async function cancelOnlineChallenge(
  challengeId: string,
  challengerId: string,
  now = new Date(),
) {
  return transitionChallenge(challengeId, challengerId, "challenger", "CANCELED", now);
}

export async function declineOnlineChallenge(
  challengeId: string,
  challengedId: string,
  now = new Date(),
) {
  return transitionChallenge(challengeId, challengedId, "challenged", "DECLINED", now);
}

export async function acceptOnlineChallenge(
  challengeId: string,
  challengedId: string,
  now = new Date(),
) {
  const prisma = requireOnlineDatabase();
  const cutoff = new Date(now.getTime() - ONLINE_PRESENCE_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await expirePendingChallenges(tx, now);
    const challenge = await getPendingChallenge(tx, challengeId, now);
    if (challenge.challengedId !== challengedId) {
      throw new OnlineServiceError(
        "CHALLENGE_FORBIDDEN",
        "Only the challenged player can accept this challenge.",
      );
    }

    const playerIds = [challenge.challengerId, challenge.challengedId];
    const availablePlayers = await tx.onlinePlayerState.findMany({
      where: {
        activeMatchId: null,
        lastSeenAt: { gt: cutoff },
        userId: { in: playerIds },
        user: { role: "PLAYER" },
      },
      select: { userId: true },
    });
    if (availablePlayers.length !== 2) {
      throw new OnlineServiceError(
        "PLAYER_NOT_AVAILABLE",
        "Both players must still be online and available.",
      );
    }

    const transition = await tx.onlineChallenge.updateMany({
      where: {
        expiresAt: { gt: now },
        id: challengeId,
        status: "PENDING",
      },
      data: {
        activeKey: null,
        respondedAt: now,
        status: "ACCEPTED",
      },
    });
    if (transition.count !== 1) {
      throw new OnlineServiceError(
        "CHALLENGE_NOT_PENDING",
        "Challenge was already handled.",
      );
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
      select: {
        blackPlayerId: true,
        id: true,
        whitePlayerId: true,
      },
    });

    const claimedPlayers = await tx.onlinePlayerState.updateMany({
      where: {
        activeMatchId: null,
        lastSeenAt: { gt: cutoff },
        userId: { in: playerIds },
      },
      data: { activeMatchId: match.id },
    });
    if (claimedPlayers.count !== 2) {
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
      data: {
        activeKey: null,
        respondedAt: now,
        status: "CANCELED",
      },
    });

    return match;
  });
}

async function transitionChallenge(
  challengeId: string,
  actorId: string,
  actorRole: "challenger" | "challenged",
  status: "CANCELED" | "DECLINED",
  now: Date,
) {
  const prisma = requireOnlineDatabase();

  return prisma.$transaction(async (tx) => {
    await expirePendingChallenges(tx, now);
    const challenge = await getPendingChallenge(tx, challengeId, now);
    const expectedActorId = actorRole === "challenger"
      ? challenge.challengerId
      : challenge.challengedId;
    if (actorId !== expectedActorId) {
      throw new OnlineServiceError(
        "CHALLENGE_FORBIDDEN",
        "Player cannot perform this challenge transition.",
      );
    }

    const result = await tx.onlineChallenge.updateMany({
      where: { id: challengeId, status: "PENDING", expiresAt: { gt: now } },
      data: { activeKey: null, respondedAt: now, status },
    });
    if (result.count !== 1) {
      throw new OnlineServiceError(
        "CHALLENGE_NOT_PENDING",
        "Challenge was already handled.",
      );
    }

    return { id: challengeId, status };
  });
}

async function getPendingChallenge(
  tx: Prisma.TransactionClient,
  challengeId: string,
  now: Date,
) {
  const challenge = await tx.onlineChallenge.findUnique({
    where: { id: challengeId },
    select: {
      challengedId: true,
      challengerId: true,
      expiresAt: true,
      id: true,
      status: true,
    },
  });

  if (!challenge) {
    throw new OnlineServiceError("CHALLENGE_NOT_FOUND", "Challenge does not exist.");
  }
  if (challenge.status === "EXPIRED" || challenge.expiresAt.getTime() <= now.getTime()) {
    throw new OnlineServiceError("CHALLENGE_EXPIRED", "Challenge has expired.");
  }
  if (challenge.status !== "PENDING") {
    throw new OnlineServiceError(
      "CHALLENGE_NOT_PENDING",
      "Challenge was already handled.",
    );
  }

  return challenge;
}

async function expirePendingChallenges(tx: Prisma.TransactionClient, now: Date) {
  await tx.onlineChallenge.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
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
