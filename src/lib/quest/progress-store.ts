import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import type { DemoQuestCardSeed } from "@/lib/demo-seed";
import { ensureQuestDataReady } from "@/lib/quest/ensure-demo-map";
import { getPrimaryPublishedQuestMap } from "@/lib/quest/quest-repository";

function getProgressFile() {
  const dataDir = process.env.CHESS_QUEST_DATA_DIR || path.join(process.cwd(), ".data");
  return path.join(dataDir, "card-progress.json");
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
    const awardedScore = isFirstWin ? card.rewardScore : Math.max(1, Math.floor(card.rewardScore * 0.1));
    const awardedGold = isFirstWin ? card.rewardGold : Math.max(1, Math.floor(card.rewardGold * 0.1));
    const now = new Date();

    const next = await prisma.cardProgress.upsert({
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

    return {
      cardSlug: card.slug,
      isFirstWin,
      awardedGold,
      awardedScore,
      totalGold: next.earnedGold,
      totalScore: next.earnedScore,
      wins: next.victories,
    };
  }

  const store = await readFileStore();
  const userProgress = store.users[userId] ?? {};
  const current = userProgress[card.slug];
  const isFirstWin = !current?.completed;
  const awardedScore = isFirstWin ? card.rewardScore : Math.max(1, Math.floor(card.rewardScore * 0.1));
  const awardedGold = isFirstWin ? card.rewardGold : Math.max(1, Math.floor(card.rewardGold * 0.1));

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

  return {
    cardSlug: card.slug,
    isFirstWin,
    awardedGold,
    awardedScore,
    totalGold: next.earnedGold,
    totalScore: next.earnedScore,
    wins: next.wins,
  };
}

export async function spendUserGold(userId: string, costGold: number): Promise<SpendGoldResult> {
  const cost = Math.max(0, Math.floor(costGold));
  if (cost === 0) {
    const summary = (await getAllUserProgressSummaries()).get(userId);
    return { availableGold: summary?.earnedGold ?? 0, ok: true };
  }

  if (isDatabaseConfigured()) {
    await ensureQuestDataReady();
    const prisma = getPrisma();
    const map = await getPrimaryPublishedQuestMap();
    const cards = map?.cards ?? [];
    const cardSlugs = cards.map((card) => card.slug);
    const [dbCards, records] = await Promise.all([
      prisma.questCard.findMany({ where: { slug: { in: cardSlugs } }, select: { id: true, slug: true } }),
      prisma.cardProgress.findMany({ where: { userId }, include: { card: { select: { slug: true } } } }),
    ]);
    const cardIds = new Map(dbCards.map((card) => [card.slug, card.id]));
    const progressBySlug = new Map(records.map((record) => [record.card.slug, record]));
    const wallet = cards
      .map((card) => {
        const record = progressBySlug.get(card.slug);
        return {
          card: { completed: card.completed, rewardGold: card.rewardGold, slug: card.slug },
          record,
          availableGold: (card.completed ? card.rewardGold : 0) + (record?.earnedGold ?? 0),
        };
      })
      .filter((entry) => entry.availableGold > 0);
    for (const record of records) {
      if (cardSlugs.includes(record.card.slug) || record.earnedGold <= 0) continue;
      wallet.push({
        card: { completed: false, rewardGold: 0, slug: record.card.slug },
        record,
        availableGold: record.earnedGold,
      });
    }
    const totalGold = wallet.reduce((total, entry) => total + entry.availableGold, 0);
    if (totalGold < cost) return { availableGold: totalGold, ok: false };

    let remaining = cost;
    await prisma.$transaction(async (tx) => {
      for (const entry of wallet) {
        if (remaining <= 0) break;

        const spendFromCard = Math.min(entry.availableGold, remaining);
        remaining -= spendFromCard;

        if (entry.record) {
          await tx.cardProgress.update({
            where: { id: entry.record.id },
            data: { earnedGold: entry.record.earnedGold - spendFromCard },
          });
          continue;
        }

        const cardId = cardIds.get(entry.card.slug);
        if (!cardId) throw new Error(`Card not found for gold spend: ${entry.card.slug}`);

        await tx.cardProgress.create({
          data: {
            cardId,
            completed: false,
            earnedGold: -spendFromCard,
            earnedScore: 0,
            userId,
            victories: 0,
          },
        });
      }
    });

    return { availableGold: totalGold - cost, ok: true };
  }

  const store = await readFileStore();
  const map = await getPrimaryPublishedQuestMap();
  const cards = map?.cards ?? [];
  const userProgress = store.users[userId] ?? {};
  const wallet = cards
    .map((card) => {
      const record = userProgress[card.slug];
      return {
        card: { completed: card.completed, rewardGold: card.rewardGold, slug: card.slug },
        record,
        availableGold: (card.completed ? card.rewardGold : 0) + (record?.earnedGold ?? 0),
      };
    })
    .filter((entry) => entry.availableGold > 0);
  for (const [slug, record] of Object.entries(userProgress)) {
    if (cards.some((card) => card.slug === slug) || record.earnedGold <= 0) continue;
    wallet.push({
      card: { completed: false, rewardGold: 0, slug },
      record,
      availableGold: record.earnedGold,
    });
  }
  const totalGold = wallet.reduce((total, entry) => total + entry.availableGold, 0);
  if (totalGold < cost) return { availableGold: totalGold, ok: false };

  let remaining = cost;
  for (const entry of wallet) {
    if (remaining <= 0) break;

    const spendFromCard = Math.min(entry.availableGold, remaining);
    remaining -= spendFromCard;
    const current = entry.record;
    userProgress[entry.card.slug] = {
      cardSlug: entry.card.slug,
      completed: current?.completed ?? false,
      earnedGold: (current?.earnedGold ?? 0) - spendFromCard,
      earnedScore: current?.earnedScore ?? 0,
      updatedAt: new Date().toISOString(),
      wins: current?.wins ?? 0,
    };
  }

  store.users[userId] = userProgress;
  await writeFileStore(store);
  return { availableGold: totalGold - cost, ok: true };
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
