import { demoMapSeed, demoMapSeeds, type DemoQuestCardSeed, type DemoQuestMapSeed } from "@/lib/demo-seed";
import { getFenSideToMove, STARTING_FEN, type SideToMove } from "@/lib/chess/fen-validation";
import { getUserCardProgress } from "@/lib/quest/progress-store";
import { describeCardObjective, getCardObjective, objectiveShortLabel, type CardObjective } from "@/lib/quest/card-objectives";
import { canOpenNextMapFromScores, getMapCompletionPercent } from "@/lib/quest/map-unlock";
import { getGameCardBySlug, getPrimaryPublishedQuestMap, listPublishedQuestMaps, resolveCardStartingFen } from "@/lib/quest/quest-repository";

export type QuestMapView = {
  slug: string;
  title: string;
  description: string;
  order: number;
  isPublished: boolean;
  cards: QuestMapCardView[];
  maxScore: number;
  earnedScore: number;
  earnedGold: number;
  completedCards: number;
  totalWins: number;
  completionPercent: number;
  canOpenNextMap: boolean;
};

export type QuestMapNavigationItem = {
  href: string;
  isUnlocked: boolean;
  order: number;
  slug: string;
  title: string;
};

export type QuestMapPageData = {
  current: QuestMapNavigationItem;
  maps: QuestMapNavigationItem[];
  map: QuestMapView;
  next: QuestMapNavigationItem | null;
  previous: QuestMapNavigationItem | null;
};

export type QuestMapCardView = DemoQuestCardSeed & {
  earnedGold: number;
  earnedScore: number;
  objective: CardObjective;
  objectiveLabel: string;
  wins: number;
};

export type GameCardView = DemoQuestCardSeed & {
  mapSlug: string;
  objective: CardObjective;
  objectiveLabel: string;
  objectiveShortLabel: string;
  startingFen: string;
  sideToMove: SideToMove;
  usesStandardSetup: boolean;
};

export async function getCurrentQuestMap(userId?: string): Promise<QuestMapView> {
  const map = (await getPrimaryPublishedQuestMap()) ?? demoMapSeed;
  return toQuestMapView(map, userId);
}

export async function getQuestMapPageData(userId?: string, requestedSlug?: string): Promise<QuestMapPageData> {
  const maps = await listPublishedQuestMaps();
  const publishedMaps = maps.length > 0 ? maps : demoMapSeeds.filter((map) => map.isPublished);
  const views = await Promise.all(publishedMaps.map((map) => toQuestMapView(map, userId)));
  const navigation = views.map<QuestMapNavigationItem>((view, index) => ({
    href: `/map?map=${encodeURIComponent(view.slug)}`,
    isUnlocked: index === 0 || views[index - 1]?.canOpenNextMap === true,
    order: view.order,
    slug: view.slug,
    title: view.title,
  }));
  const requestedIndex = requestedSlug ? navigation.findIndex((item) => item.slug === requestedSlug) : -1;
  const fallbackIndex = Math.max(0, getLastUnlockedIndex(navigation));
  const selectedIndex = requestedIndex >= 0 && navigation[requestedIndex]?.isUnlocked ? requestedIndex : fallbackIndex;

  return {
    current: navigation[selectedIndex] ?? navigation[0]!,
    map: views[selectedIndex] ?? views[0]!,
    maps: navigation,
    next: navigation[selectedIndex + 1] ?? null,
    previous: navigation[selectedIndex - 1] ?? null,
  };
}

function getLastUnlockedIndex(navigation: QuestMapNavigationItem[]) {
  for (let index = navigation.length - 1; index >= 0; index -= 1) {
    if (navigation[index]?.isUnlocked) return index;
  }

  return 0;
}

export async function getGameCardById(cardId: string): Promise<GameCardView | null> {
  const loaded = await getGameCardBySlug(cardId);
  if (!loaded) return null;

  return toGameCardView(loaded.card, loaded.map);
}

async function toQuestMapView(map: DemoQuestMapSeed, userId?: string): Promise<QuestMapView> {
  const progress = await getUserCardProgress(userId);
  const cards = map.cards.map<QuestMapCardView>((card) => {
    const cardProgress = progress.get(card.slug);
    const seedScore = card.completed ? card.rewardScore : 0;
    const seedGold = card.completed ? card.rewardGold : 0;

    const objective = getCardObjective(card);

    return {
      ...card,
      completed: card.completed || Boolean(cardProgress?.completed),
      earnedGold: seedGold + (cardProgress?.earnedGold ?? 0),
      earnedScore: seedScore + (cardProgress?.earnedScore ?? 0),
      objective,
      objectiveLabel: objectiveShortLabel(objective),
      wins: (card.completed ? 1 : 0) + (cardProgress?.wins ?? 0),
    };
  });
  const maxScore = cards.reduce((total, card) => total + card.rewardScore, 0);
  const earnedScore = cards.reduce((total, card) => total + card.earnedScore, 0);
  const earnedGold = cards.reduce((total, card) => total + card.earnedGold, 0);
  const completedCards = cards.filter((card) => card.completed).length;
  const totalWins = cards.reduce((total, card) => total + card.wins, 0);
  const completionPercent = getMapCompletionPercent(earnedScore, maxScore);

  return {
    slug: map.slug,
    title: map.title,
    description: map.description,
    order: map.order,
    isPublished: map.isPublished,
    cards,
    maxScore,
    earnedScore,
    earnedGold,
    completedCards,
    totalWins,
    completionPercent,
    canOpenNextMap: canOpenNextMapFromScores(earnedScore, maxScore),
  };
}

function toGameCardView(card: DemoQuestCardSeed, map: DemoQuestMapSeed): GameCardView {
  const startingFen = resolveCardStartingFen(card, map);
  const objective = getCardObjective(card);

  return {
    ...card,
    mapSlug: map.slug,
    objective,
    objectiveLabel: describeCardObjective(objective),
    objectiveShortLabel: objectiveShortLabel(objective),
    startingFen,
    sideToMove: getFenSideToMove(startingFen) ?? "white",
    usesStandardSetup: !card.boardTemplateSlug && !card.startingFen,
  };
}
