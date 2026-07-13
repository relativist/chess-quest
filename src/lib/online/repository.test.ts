import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOnlineDatabase: vi.fn(),
}));

vi.mock("@/lib/online/server-auth", () => ({
  requireOnlineDatabase: mocks.requireOnlineDatabase,
}));

import {
  acceptOnlineChallenge,
  createOnlineChallenge,
} from "@/lib/online/repository";

const NOW = new Date("2026-07-12T12:00:00.000Z");

function transactionDatabase(tx: object) {
  return {
    $transaction: vi.fn(async (operation: (client: object) => unknown) => operation(tx)),
  };
}

describe("online challenge repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a challenge only after both fresh players are available", async () => {
    const created = {
      expiresAt: new Date(NOW.getTime() + 30_000),
      id: "challenge",
      status: "PENDING",
    };
    const tx = {
      onlineChallenge: {
        create: vi.fn().mockResolvedValue(created),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      onlinePlayerState: {
        findMany: vi.fn().mockResolvedValue([
          { userId: "alice" },
          { userId: "bob" },
        ]),
      },
    };
    mocks.requireOnlineDatabase.mockReturnValue(transactionDatabase(tx));

    await expect(createOnlineChallenge("alice", "bob", NOW)).resolves.toEqual(created);
    expect(tx.onlineChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeKey: JSON.stringify(["alice", "bob"]),
        challengedId: "bob",
        challengerId: "alice",
      }),
      select: { expiresAt: true, id: true, status: true },
    });
  });

  it("maps a duplicate active pair to a stable service error", async () => {
    const tx = {
      onlineChallenge: {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      onlinePlayerState: {
        findMany: vi.fn().mockResolvedValue([
          { userId: "alice" },
          { userId: "bob" },
        ]),
      },
    };
    mocks.requireOnlineDatabase.mockReturnValue(transactionDatabase(tx));

    await expect(createOnlineChallenge("alice", "bob", NOW)).rejects.toMatchObject({
      code: "CHALLENGE_ALREADY_PENDING",
    });
  });

  it("accepts once, creates a match and atomically claims both players", async () => {
    const onlineChallengeUpdate = vi.fn()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    const matchCreate = vi.fn().mockImplementation(({ data }) => Promise.resolve({
      blackPlayerId: data.blackPlayerId,
      id: "match",
      whitePlayerId: data.whitePlayerId,
    }));
    const playerUpdate = vi.fn().mockResolvedValue({ count: 2 });
    const tx = {
      onlineChallenge: {
        findUnique: vi.fn().mockResolvedValue({
          challengedId: "bob",
          challengerId: "alice",
          expiresAt: new Date(NOW.getTime() + 10_000),
          id: "challenge",
          status: "PENDING",
        }),
        updateMany: onlineChallengeUpdate,
      },
      onlineMatch: { create: matchCreate },
      onlinePlayerState: {
        findMany: vi.fn().mockResolvedValue([
          { userId: "alice" },
          { userId: "bob" },
        ]),
        updateMany: playerUpdate,
      },
    };
    mocks.requireOnlineDatabase.mockReturnValue(transactionDatabase(tx));

    const match = await acceptOnlineChallenge("challenge", "bob", NOW);

    expect(new Set([match.whitePlayerId, match.blackPlayerId]))
      .toEqual(new Set(["alice", "bob"]));
    expect(matchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        challengeId: "challenge",
        fen: expect.stringContaining(" w "),
      }),
      select: {
        blackPlayerId: true,
        id: true,
        whitePlayerId: true,
      },
    });
    expect(playerUpdate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        activeMatchId: null,
        userId: { in: ["alice", "bob"] },
      }),
      data: { activeMatchId: "match" },
    });
  });

  it("rejects acceptance by anyone except the challenged player", async () => {
    const tx = {
      onlineChallenge: {
        findUnique: vi.fn().mockResolvedValue({
          challengedId: "bob",
          challengerId: "alice",
          expiresAt: new Date(NOW.getTime() + 10_000),
          id: "challenge",
          status: "PENDING",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mocks.requireOnlineDatabase.mockReturnValue(transactionDatabase(tx));

    await expect(acceptOnlineChallenge("challenge", "mallory", NOW))
      .rejects.toMatchObject({ code: "CHALLENGE_FORBIDDEN" });
  });
});
