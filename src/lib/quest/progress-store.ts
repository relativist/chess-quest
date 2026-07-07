import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {
    getAllStoredUserGoldBalances,
    getStoredUserGold,
    incrementStoredUserGold,
    spendStoredUserGold
} from "@/lib/auth/auth-store";
import {getPrisma, isDatabaseConfigured} from "@/lib/db/prisma";
import type {DemoQuestCardSeed} from "@/lib/demo-seed";
import {ensureQuestDataReady} from "@/lib/quest/ensure-demo-map";

function getProgressFile() {
  const dataDir = process.env.CHESS_QUEST_DATA_DIR || path.join(process.cwd(), ".data");
  return path.join(dataDir, "card-progress.json");
}

const REPEAT_CARD_REWARD_RATE = 0.5;

export function calculateRepeatCardReward(reward: number) {
  return Math.max(1, Math.floor(reward * REPEAT_CARD_REWARD_RATE));
}


export type CardProgressRecord = {
  cardSlug: string;
  completed: boolean;
  wins: number;
  earnedScore: number;
  earnedGold: number;
  updatedAt: string;
};

type StoredProgress = {
  users: Record<string, Record<string, CardProgressRecord>>;
};


export type VictoryResult = {
  cardSlug: string;
  isFirstWin: boolean;
  awardedGold: number;
  awardedScore: number;
  totalGold: number;
  totalScore: number;
  wins: number;
};

export type UserProgressSummary = {
  completedCards: number;
  earnedGold: number;
  earnedScore: number;
  wins: number;
};

export type SpendGoldResult = {
  availableGold: number;
  ok: boolean;
};

export async function getUserGold(userId: string | undefined) {
  if (!userId) return 0;

  if (isDatabaseConfigured()) {
    const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { gold: true } });
    return user?.gold ?? 0;
  }

  return getStoredUserGold(userId);
}

export async function getAllUserGoldBalances() {
  if (isDatabaseConfigured()) {
    const users = await getPrisma().user.findMany({ select: { gold: true, id: true } });
    return new Map(users.map((user) => [user.id, user.gold]));
  }

  return getAllStoredUserGoldBalances();
}

export async function getAllUserProgressSummaries() {
  if (isDatabaseConfigured()) {
    await ensureQuestDataReady();
    const records = await getPrisma().cardProgress.findMany({
      select: {
        completed: true,
        earnedGold: true,
        earnedScore: true,
        victories: true,
        userId: true,
      },
    });

    const summaries = new Map<string, UserProgressSummary>();
    for (const record of records) {
      const current = summaries.get(record.userId) ?? { completedCards: 0, earnedGold: 0, earnedScore: 0, wins: 0 };
      summaries.set(record.userId, {
        completedCards: current.completedCards + (record.completed ? 1 : 0),
        earnedGold: current.earnedGold + record.earnedGold,
        earnedScore: current.earnedScore + record.earnedScore,
        wins: current.wins + record.victories,
      });
    }

    return summaries;
  }

  const store = await readFileStore();
  const summaries = new Map<string, UserProgressSummary>();

  for (const [userId, cards] of Object.entries(store.users)) {
    const records = Object.values(cards);
    summaries.set(userId, {
      completedCards: records.filter((record) => record.completed).length,
      earnedGold: records.reduce((total, record) => total + record.earnedGold, 0),
      earnedScore: records.reduce((total, record) => total + record.earnedScore, 0),
      wins: records.reduce((total, record) => total + record.wins, 0),
    });
  }

  return summaries;
}

export async function getUserCardProgress(userId: string | undefined) {
  if (!userId) return new Map<string, CardProgressRecord>();

  if (isDatabaseConfigured()) {
    await ensureQuestDataReady();
    const records = await getPrisma().cardProgress.findMany({
      where: { userId },
      include: { card: { select: { slug: true } } },
    });

    return new Map(
      records.map((record) => [
        record.card.slug,
        {
          cardSlug: record.card.slug,
          completed: record.completed,
          wins: record.victories,
          earnedScore: record.earnedScore,
          earnedGold: record.earnedGold,
          updatedAt: record.updatedAt.toISOString(),
        },
      ]),
    );
  }

  const store = await readFileStore();
  return new Map(Object.entries(store.users[userId] ?? {}));
}

export async function markCardVictory(userId: string, card: Pick<DemoQuestCardSeed, "rewardGold" | "rewardScore" | "slug">): Promise<VictoryResult> {
  if (isDatabaseConfigured()) {
    await ensureQuestDataReady();
    const prisma = getPrisma();
    const dbCard = await prisma.questCard.findUnique({ where: { slug: card.slug }, select: { id: true } });
    if (!dbCard) throw new Error(`Card not found: ${card.slug}`);

    const current = await prisma.cardProgress.findUnique({
      where: { userId_cardId: { userId, cardId: dbCard.id } },
    });
    const isFirstWin = !current?.completed;
    const awardedScore = isFirstWin ? card.rewardScore : calculateRepeatCardReward(card.rewardScore);
    const awardedGold = isFirstWin ? card.rewardGold : calculateRepeatCardReward(card.rewardGold);
    const now = new Date();

    const { next, user } = await prisma.$transaction(async (tx) => {
      const nextProgress = await tx.cardProgress.upsert({
        where: { userId_cardId: { userId, cardId: dbCard.id } },
        update: {
          completed: true,
          victories: (current?.victories ?? 0) + 1,
          earnedScore: (current?.earnedScore ?? 0) + awardedScore,
          earnedGold: (current?.earnedGold ?? 0) + awardedGold,
          lastCompletedAt: now,
          firstCompletedAt: current?.firstCompletedAt ?? now,
        },
        create: {
          userId,
          cardId: dbCard.id,
          completed: true,
          victories: 1,
          earnedScore: awardedScore,
          earnedGold: awardedGold,
          firstCompletedAt: now,
          lastCompletedAt: now,
        },
      });
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { gold: { increment: awardedGold } },
        select: { gold: true },
      });

      return { next: nextProgress, user: updatedUser };
    });

    return {
      cardSlug: card.slug,
      isFirstWin,
      awardedGold,
      awardedScore,
      totalGold: user.gold,
      totalScore: next.earnedScore,
      wins: next.victories,
    };
  }

  const store = await readFileStore();
  const userProgress = store.users[userId] ?? {};
  const current = userProgress[card.slug];
  const isFirstWin = !current?.completed;
  const awardedScore = isFirstWin ? card.rewardScore : calculateRepeatCardReward(card.rewardScore);
  const awardedGold = isFirstWin ? card.rewardGold : calculateRepeatCardReward(card.rewardGold);

  const next: CardProgressRecord = {
    cardSlug: card.slug,
    completed: true,
    wins: (current?.wins ?? 0) + 1,
    earnedScore: (current?.earnedScore ?? 0) + awardedScore,
    earnedGold: (current?.earnedGold ?? 0) + awardedGold,
    updatedAt: new Date().toISOString(),
  };

  userProgress[card.slug] = next;
  store.users[userId] = userProgress;
  await writeFileStore(store);
  const totalGold = await incrementStoredUserGold(userId, awardedGold);

  return {
    cardSlug: card.slug,
    isFirstWin,
    awardedGold,
    awardedScore,
    totalGold,
    totalScore: next.earnedScore,
    wins: next.wins,
  };
}

export async function spendUserGold(userId: string, costGold: number): Promise<SpendGoldResult> {
  const cost = Math.max(0, Math.floor(costGold));
  if (cost === 0) {
    return { availableGold: await getUserGold(userId), ok: true };
  }

  if (isDatabaseConfigured()) {
    const prisma = getPrisma();
    const updated = await prisma.user.updateMany({
      where: { id: userId, gold: { gte: cost } },
      data: { gold: { decrement: cost } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { gold: true } });

    return { availableGold: user?.gold ?? 0, ok: updated.count === 1 };
  }

  return spendStoredUserGold(userId, cost);
}

async function readFileStore(): Promise<StoredProgress> {
  try {
    const content = await readFile(getProgressFile(), "utf8");
    const parsed = JSON.parse(content) as StoredProgress;
    return { users: parsed.users ?? {} };
  } catch {
    return { users: {} };
  }
}

async function writeFileStore(store: StoredProgress) {
  const progressFile = getProgressFile();
  await mkdir(path.dirname(progressFile), { recursive: true });
  await writeFile(progressFile, `${JSON.stringify(store, null, 2)}
`, "utf8");
}
