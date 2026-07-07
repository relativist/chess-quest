import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {
    getAllUserProgressSummaries,
    getUserCardProgress,
    getUserGold,
    markCardVictory,
    spendUserGold
} from "./progress-store";

const card = {
  slug: "reward-test",
  rewardGold: 75,
  rewardScore: 125,
};

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "chess-quest-progress-"));
  process.env.CHESS_QUEST_DATA_DIR = tempDir;
  await seedUsers();
});

afterEach(async () => {
  delete process.env.CHESS_QUEST_DATA_DIR;
  if (tempDir) await rm(tempDir, { force: true, recursive: true });
});

async function seedUsers() {
  await mkdir(tempDir, { recursive: true });
  await writeFile(
    path.join(tempDir, "auth-users.json"),
    JSON.stringify(
      {
        users: [
          {
            id: "player-1",
            login: "player-1",
            email: null,
            displayName: "Player 1",
            passwordHash: "test-only",
            role: "PLAYER",
            gold: 0,
            createdAt: new Date().toISOString(),
          },
          {
            id: "player-2",
            login: "player-2",
            email: null,
            displayName: "Player 2",
            passwordHash: "test-only",
            role: "PLAYER",
            gold: 0,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
}

describe("progress-store rewards", () => {
  it("awards full card rewards on first victory", async () => {
    const result = await markCardVictory("player-1", card);

    expect(result).toMatchObject({
      awardedGold: 75,
      awardedScore: 125,
      isFirstWin: true,
      totalGold: 75,
      totalScore: 125,
      wins: 1,
    });

    const progress = await getUserCardProgress("player-1");
    expect(progress.get("reward-test")).toMatchObject({ completed: true, earnedGold: 75, earnedScore: 125, wins: 1 });
  });

  it("awards 50 percent on repeated victories", async () => {
    await markCardVictory("player-1", card);
    const result = await markCardVictory("player-1", card);

    expect(result).toMatchObject({
      awardedGold: 37,
      awardedScore: 62,
      isFirstWin: false,
      totalGold: 112,
      totalScore: 187,
      wins: 2,
    });
  });

  it("summarizes progress for leaderboard ranking", async () => {
    await markCardVictory("player-1", card);
    await markCardVictory("player-1", card);
    await markCardVictory("player-2", { slug: "small-card", rewardGold: 1, rewardScore: 1 });
    await markCardVictory("player-2", { slug: "small-card", rewardGold: 1, rewardScore: 1 });

    const summaries = await getAllUserProgressSummaries();

    expect(summaries.get("player-1")).toMatchObject({
      completedCards: 1,
      earnedGold: 112,
      earnedScore: 187,
      wins: 2,
    });
    expect(summaries.get("player-2")).toMatchObject({
      completedCards: 1,
      earnedGold: 2,
      earnedScore: 2,
      wins: 2,
    });
  });

  it("spends user gold without changing card reward history", async () => {
    await markCardVictory("player-1", card);

    expect(await spendUserGold("player-1", 25)).toMatchObject({ availableGold: 50, ok: true });
    expect(await spendUserGold("player-1", 60)).toMatchObject({ availableGold: 50, ok: false });
    expect(await getUserGold("player-1")).toBe(50);

    const progress = await getUserCardProgress("player-1");
    expect(progress.get("reward-test")).toMatchObject({ earnedGold: 75 });
  });
});
