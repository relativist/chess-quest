import { Chess } from "chess.js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import {
  applyOnlineMagic,
  getOnlineMatchSnapshot,
  playOnlineMove,
  handleOnlineDrawAction,
  surrenderOnlineMatch,
} from "@/lib/online/match-repository";
import { handleOnlineRematchAction } from "@/lib/online/rematch-repository";
import {
  acceptOnlineChallenge,
  createOnlineChallenge,
  heartbeatOnlinePresence,
} from "@/lib/online/repository";

const integrationDescribe = process.env.ONLINE_INTEGRATION_DATABASE_URL
  ? describe
  : describe.skip;

const PLAYER_IDS = ["online-int-alice", "online-int-bob", "online-int-carol"];
const NOW = new Date("2026-07-12T13:00:00.000Z");

integrationDescribe("online repository PostgreSQL concurrency", () => {
  beforeEach(async () => {
    const prisma = getPrisma();
    await prisma.onlineMatch.deleteMany();
    await prisma.onlineChallenge.deleteMany();
    await prisma.onlinePlayerState.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.user.deleteMany({ where: { id: { in: PLAYER_IDS } } });

    await prisma.user.createMany({
      data: PLAYER_IDS.map((id) => ({
        displayName: id,
        id,
        login: id,
        passwordHash: "integration-only",
        role: "PLAYER" as const,
      })),
    });
    await Promise.all(PLAYER_IDS.map((id) => heartbeatOnlinePresence(id, NOW)));
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.onlineMatch.deleteMany();
    await prisma.onlineChallenge.deleteMany();
    await prisma.onlinePlayerState.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.user.deleteMany({ where: { id: { in: PLAYER_IDS } } });
    await prisma.$disconnect();
  });

  it("allows only one concurrent acceptance for the same challenged player", async () => {
    const first = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const second = await createOnlineChallenge(PLAYER_IDS[2], PLAYER_IDS[1], NOW);

    const results = await Promise.allSettled([
      acceptOnlineChallenge(first.id, PLAYER_IDS[1], NOW),
      acceptOnlineChallenge(second.id, PLAYER_IDS[1], NOW),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const prisma = getPrisma();
    const [matches, challenges, states] = await Promise.all([
      prisma.onlineMatch.findMany(),
      prisma.onlineChallenge.findMany({
        orderBy: { id: "asc" },
        select: { activeKey: true, status: true },
      }),
      prisma.onlinePlayerState.findMany({
        orderBy: { userId: "asc" },
        select: { activeMatchId: true, userId: true },
      }),
    ]);

    expect(matches).toHaveLength(1);
    expect(challenges.map((challenge) => challenge.status).sort())
      .toEqual(["ACCEPTED", "CANCELED"]);
    expect(challenges.every((challenge) => challenge.activeKey === null)).toBe(true);
    expect(states.filter((state) => state.activeMatchId === matches[0].id)).toHaveLength(2);
    expect(states.filter((state) => state.activeMatchId === null)).toHaveLength(1);
  });
  it("applies one versioned move, replays duplicates and rejects a stale concurrent move", async () => {
    const challenge = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const match = await acceptOnlineChallenge(challenge.id, PLAYER_IDS[1], NOW);
    const commandTime = new Date(NOW.getTime() + 1_000);

    const first = await playOnlineMove(match.id, match.whitePlayerId, {
      clientRequestId: "move-white-e2e4",
      expectedVersion: 0,
      from: "e2",
      to: "e4",
    }, commandTime);
    expect(first.version).toBe(1);
    expect(first.turnColor).toBe("black");
    expect(first.clocks.whiteTimeMs).toBe(599_000);

    const duplicate = await playOnlineMove(match.id, match.whitePlayerId, {
      clientRequestId: "move-white-e2e4",
      expectedVersion: 0,
      from: "e2",
      to: "e4",
    }, commandTime);
    expect(duplicate.version).toBe(1);

    const blackCommandTime = new Date(commandTime.getTime() + 1_000);
    const results = await Promise.allSettled([
      playOnlineMove(match.id, match.blackPlayerId, {
        clientRequestId: "move-black-e7e5",
        expectedVersion: 1,
        from: "e7",
        to: "e5",
      }, blackCommandTime),
      playOnlineMove(match.id, match.blackPlayerId, {
        clientRequestId: "move-black-d7d5",
        expectedVersion: 1,
        from: "d7",
        to: "d5",
      }, blackCommandTime),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const snapshot = await getOnlineMatchSnapshot(match.id, match.whitePlayerId, blackCommandTime);
    expect(snapshot.version).toBe(2);
    expect(snapshot.history).toHaveLength(2);
    expect(snapshot.turnColor).toBe("white");
  });

  it("applies pawn magic once and stores its match-only coin balance", async () => {
    const challenge = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const match = await acceptOnlineChallenge(challenge.id, PLAYER_IDS[1], NOW);
    const command = {
      clientRequestId: "magic-white-e2-knight",
      expectedVersion: 0,
      magicId: "promote_pawn_knight",
      targetSquare: "e2",
    };

    const first = await applyOnlineMagic(
      match.id,
      match.whitePlayerId,
      command,
      new Date(NOW.getTime() + 1_000),
    );
    expect(first.version).toBe(1);
    expect(first.magicCoins.white).toBe(380);
    expect(new Chess(first.fen).get("e2")).toMatchObject({ color: "w", type: "n" });
    expect(first.turnColor).toBe("black");

    const duplicate = await applyOnlineMagic(
      match.id,
      match.whitePlayerId,
      command,
      new Date(NOW.getTime() + 1_000),
    );
    expect(duplicate.version).toBe(1);
    expect(duplicate.magicCoins.white).toBe(380);
    expect(duplicate.history).toHaveLength(1);
  });

  it("finalizes concurrent surrender exactly once and records a zero loser delta", async () => {
    const challenge = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const match = await acceptOnlineChallenge(challenge.id, PLAYER_IDS[1], NOW);
    const command = {
      clientRequestId: "surrender-concurrent-alice",
      expectedVersion: 0,
    };

    const results = await Promise.allSettled([
      surrenderOnlineMatch(match.id, PLAYER_IDS[0], command, new Date(NOW.getTime() + 1_000)),
      surrenderOnlineMatch(match.id, PLAYER_IDS[0], command, new Date(NOW.getTime() + 1_000)),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);

    const retry = await surrenderOnlineMatch(
      match.id,
      PLAYER_IDS[0],
      command,
      new Date(NOW.getTime() + 2_000),
    );
    expect(retry.status).toBe("FINISHED");
    expect(retry.result?.reason).toBe("SURRENDER");

    const prisma = getPrisma();
    const stored = await prisma.onlineMatch.findUniqueOrThrow({
      where: { id: match.id },
      include: { ratingChanges: true },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [match.whitePlayerId, match.blackPlayerId] } },
      orderBy: { onlineRating: "asc" },
      select: { id: true, onlineRating: true },
    });
    const states = await prisma.onlinePlayerState.findMany({
      where: { userId: { in: [match.whitePlayerId, match.blackPlayerId] } },
    });

    expect(stored.ratingAppliedAt).not.toBeNull();
    expect(stored.ratingChanges.map((change) => change.delta).sort()).toEqual([0, 1]);
    expect(users.map((user) => user.onlineRating)).toEqual([0, 1]);
    expect(states.every((state) => state.activeMatchId === null)).toBe(true);
    expect(await prisma.onlineMatchEvent.count({
      where: { matchId: match.id, type: "SURRENDERED" },
    })).toBe(1);
  });

  it("limits each player to three draw offers and only lets the opponent decline", async () => {
    const challenge = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const match = await acceptOnlineChallenge(challenge.id, PLAYER_IDS[1], NOW);
    let version = 0;

    for (let offer = 1; offer <= 3; offer += 1) {
      const offered = await handleOnlineDrawAction(match.id, PLAYER_IDS[0], {
        action: "offer",
        clientRequestId: `draw-offer-alice-${offer}`,
        expectedVersion: version,
      }, new Date(NOW.getTime() + offer * 1_000));
      version += 1;
      expect(offered.draw.offersUsed).toBe(offer);
      expect(offered.draw.pendingOfferBy).toBe("self");

      await expect(handleOnlineDrawAction(match.id, PLAYER_IDS[0], {
        action: "accept",
        clientRequestId: `draw-self-accept-${offer}`,
        expectedVersion: version,
      }, new Date(NOW.getTime() + offer * 1_000))).rejects.toMatchObject({
        code: "DRAW_RESPONSE_FORBIDDEN",
      });

      const declined = await handleOnlineDrawAction(match.id, PLAYER_IDS[1], {
        action: "decline",
        clientRequestId: `draw-decline-bob-${offer}`,
        expectedVersion: version,
      }, new Date(NOW.getTime() + offer * 1_000));
      version += 1;
      expect(declined.draw.pendingOfferBy).toBeNull();
    }

    await expect(handleOnlineDrawAction(match.id, PLAYER_IDS[0], {
      action: "offer",
      clientRequestId: "draw-offer-alice-four",
      expectedVersion: version,
    }, new Date(NOW.getTime() + 4_000))).rejects.toMatchObject({
      code: "DRAW_OFFER_LIMIT_REACHED",
    });
  });

  it("accepts an opponent draw without changing ratings", async () => {
    const challenge = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const match = await acceptOnlineChallenge(challenge.id, PLAYER_IDS[1], NOW);
    await handleOnlineDrawAction(match.id, PLAYER_IDS[0], {
      action: "offer",
      clientRequestId: "draw-accept-offer-alice",
      expectedVersion: 0,
    }, new Date(NOW.getTime() + 1_000));
    const accepted = await handleOnlineDrawAction(match.id, PLAYER_IDS[1], {
      action: "accept",
      clientRequestId: "draw-accept-bob",
      expectedVersion: 1,
    }, new Date(NOW.getTime() + 2_000));

    expect(accepted.status).toBe("FINISHED");
    expect(accepted.result).toMatchObject({ outcome: "DRAW", reason: "DRAW_AGREEMENT" });
    const prisma = getPrisma();
    const stored = await prisma.onlineMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(stored.ratingAppliedAt).not.toBeNull();
    expect(await prisma.onlineRatingChange.count({ where: { matchId: match.id } })).toBe(0);
    expect(await prisma.user.findMany({
      where: { id: { in: [match.whitePlayerId, match.blackPlayerId] } },
      select: { onlineRating: true },
    })).toEqual([{ onlineRating: 0 }, { onlineRating: 0 }]);
  });

  it("creates a fresh match when the opponent accepts a rematch", async () => {
    const challenge = await createOnlineChallenge(PLAYER_IDS[0], PLAYER_IDS[1], NOW);
    const match = await acceptOnlineChallenge(challenge.id, PLAYER_IDS[1], NOW);
    const finished = await surrenderOnlineMatch(match.id, match.whitePlayerId, {
      clientRequestId: "rematch-source-surrender",
      expectedVersion: 0,
    }, new Date(NOW.getTime() + 1_000));
    expect(finished.status).toBe("FINISHED");

    const offered = await handleOnlineRematchAction(
      match.id,
      match.whitePlayerId,
      { action: "offer" },
      new Date(NOW.getTime() + 2_000),
    );
    expect(offered.snapshot?.rematch.state).toBe("OFFERED_BY_YOU");
    const rematchChallengeId = offered.snapshot?.rematch.challengeId;
    expect(rematchChallengeId).toBeTruthy();
    if (!rematchChallengeId) throw new Error("Rematch challenge was not created.");

    const accepted = await handleOnlineRematchAction(
      match.id,
      match.blackPlayerId,
      { action: "accept", challengeId: rematchChallengeId },
      new Date(NOW.getTime() + 3_000),
    );
    expect(accepted.nextMatchId).toBeTruthy();
    expect(accepted.nextMatchId).not.toBe(match.id);

    const sourceSnapshot = await getOnlineMatchSnapshot(
      match.id,
      match.whitePlayerId,
      new Date(NOW.getTime() + 3_000),
    );
    expect(sourceSnapshot.rematch).toMatchObject({
      nextMatchId: accepted.nextMatchId,
      state: "MATCH_CREATED",
    });

    const nextSnapshot = await getOnlineMatchSnapshot(
      accepted.nextMatchId as string,
      match.whitePlayerId,
      new Date(NOW.getTime() + 3_000),
    );
    expect(nextSnapshot.status).toBe("ACTIVE");
    expect(nextSnapshot.version).toBe(0);
    expect(nextSnapshot.magicCoins).toEqual({ black: 500, white: 500 });
    expect(new Set([
      nextSnapshot.players.white.id,
      nextSnapshot.players.black.id,
    ])).toEqual(new Set([match.whitePlayerId, match.blackPlayerId]));
  });

});
