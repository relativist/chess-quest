import type { Prisma } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { STARTING_FEN, validateBoardTemplateFen } from "@/lib/chess/fen-validation";
import { demoMapSeed, demoMapSeeds, getCardStartingFen, type DemoQuestCardSeed, type DemoQuestMapSeed, type Difficulty } from "@/lib/demo-seed";
import { normalizeCardObjective, type CardObjective } from "@/lib/quest/card-objectives";
import { ensureQuestDataReady } from "@/lib/quest/ensure-demo-map";

const mapInclude = {
  cards: {
    include: {
      boardTemplate: {
        select: {
          slug: true,
          name: true,
          fen: true,
        },
      },
    },
    orderBy: { order: "asc" as const },
  },
} satisfies Prisma.QuestMapInclude;

type QuestMapWithCards = Prisma.QuestMapGetPayload<{ include: typeof mapInclude }>;

export type MapEditorCardInput = {
  congratulationsText: string;
  difficulty: Difficulty;
  fen: string;
  objective: CardObjective;
  order: number;
  rewardGold: number;
  rewardScore: number;
  slug: string;
  text: string;
  title: string;
};

export type MapEditorMapInput = {
  cards: MapEditorCardInput[];
  description: string;
  isPublished: boolean;
  slug: string;
  title: string;
};

export type MapEditorListItem = {
  cardCount: number;
  isPublished: boolean;
  order: number;
  slug: string;
  title: string;
};

export type SaveQuestMapResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function listQuestMapsForEditor(): Promise<MapEditorListItem[]> {
  if (!isDatabaseConfigured()) {
    return demoMapSeeds.map((map) => ({
      slug: map.slug,
      title: map.title,
      order: map.order,
      isPublished: map.isPublished,
      cardCount: map.cards.length,
    }));
  }

  await ensureQuestDataReady();
  const maps = await getPrisma().questMap.findMany({
    include: { _count: { select: { cards: true } } },
    orderBy: { order: "asc" },
  });

  return maps.map((map) => ({
    slug: map.slug,
    title: map.title,
    order: map.order,
    isPublished: map.isPublished,
    cardCount: map._count.cards,
  }));
}

export async function getGameCardBySlug(cardSlug: string): Promise<{ card: DemoQuestCardSeed; map: DemoQuestMapSeed } | null> {
  if (!isDatabaseConfigured()) {
    for (const map of demoMapSeeds) {
      const card = map.cards.find((candidate) => candidate.slug === cardSlug);
      if (card) return { card, map };
    }

    return null;
  }

  await ensureQuestDataReady();
  const dbCard = await getPrisma().questCard.findUnique({
    where: { slug: cardSlug },
    include: {
      map: {
        include: mapInclude,
      },
      boardTemplate: {
        select: {
          slug: true,
          name: true,
          fen: true,
        },
      },
    },
  });

  if (!dbCard) return null;

  const map = toDemoQuestMapSeed({
    ...dbCard.map,
    cards: dbCard.map.cards.length > 0 ? dbCard.map.cards : [{
      ...dbCard,
      boardTemplate: dbCard.boardTemplate,
    }],
  });

  const card = map.cards.find((candidate) => candidate.slug === cardSlug);
  return card ? { card, map } : null;
}

export async function getQuestMapRecordBySlug(slug: string): Promise<DemoQuestMapSeed | null> {
  if (!isDatabaseConfigured()) {
    return demoMapSeeds.find((map) => map.slug === slug) ?? null;
  }

  await ensureQuestDataReady();
  const map = await getPrisma().questMap.findUnique({
    where: { slug },
    include: mapInclude,
  });

  return map ? toDemoQuestMapSeed(map) : null;
}

export async function getPrimaryPublishedQuestMap(): Promise<DemoQuestMapSeed | null> {
  if (!isDatabaseConfigured()) return demoMapSeeds.find((map) => map.isPublished) ?? demoMapSeed;

  await ensureQuestDataReady();
  const map = await getPrisma().questMap.findFirst({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    include: mapInclude,
  });

  return map ? toDemoQuestMapSeed(map) : null;
}

export async function getPublishedQuestMapBySlug(slug: string): Promise<DemoQuestMapSeed | null> {
  if (!isDatabaseConfigured()) return demoMapSeeds.find((map) => map.isPublished && map.slug === slug) ?? null;

  await ensureQuestDataReady();
  const map = await getPrisma().questMap.findFirst({
    where: { isPublished: true, slug },
    include: mapInclude,
  });

  return map ? toDemoQuestMapSeed(map) : null;
}

export async function listPublishedQuestMaps(): Promise<DemoQuestMapSeed[]> {
  if (!isDatabaseConfigured()) return demoMapSeeds.filter((map) => map.isPublished).sort((a, b) => a.order - b.order);

  await ensureQuestDataReady();
  const maps = await getPrisma().questMap.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    include: mapInclude,
  });

  return maps.map((map) => toDemoQuestMapSeed(map));
}

export async function createQuestMap(title: string, createdById?: string) {
  await ensureQuestDataReady();
  const prisma = getPrisma();
  const maxOrder = await prisma.questMap.aggregate({ _max: { order: true } });
  const slug = await createUniqueMapSlug(title);

  return prisma.questMap.create({
    data: {
      slug,
      title: title.trim() || "Новая карта",
      description: "",
      order: (maxOrder._max.order ?? 0) + 1,
      isPublished: false,
      createdById,
    },
    select: { slug: true, title: true },
  });
}

export async function saveQuestMapFromEditor(input: MapEditorMapInput, createdById?: string): Promise<SaveQuestMapResult> {
  const validationError = validateEditorMap(input);
  if (validationError) return { ok: false, error: validationError };

  await ensureQuestDataReady();
  const prisma = getPrisma();
  const cardSlugs = input.cards.map((card) => card.slug);

  const map = await prisma.questMap.upsert({
    where: { slug: input.slug },
    update: {
      title: input.title.trim(),
      description: input.description.trim(),
      isPublished: input.isPublished,
    },
    create: {
      slug: input.slug,
      title: input.title.trim() || "Новая карта",
      description: input.description.trim(),
      order: await nextMapOrder(),
      isPublished: input.isPublished,
      createdById,
    },
    select: { id: true },
  });

  await prisma.questCard.deleteMany({
    where: {
      mapId: map.id,
      slug: { notIn: cardSlugs },
    },
  });

  for (const card of input.cards) {
    const startingFen = card.fen.trim() || null;

    await prisma.questCard.upsert({
      where: { slug: card.slug },
      update: {
        order: card.order,
        title: card.title.trim(),
        text: card.text.trim(),
        congratulationsText: card.congratulationsText.trim(),
        objective: card.objective,
        startingFen,
        difficulty: card.difficulty,
        rewardGold: card.rewardGold,
        rewardScore: card.rewardScore,
        mapId: map.id,
        boardTemplateId: null,
      },
      create: {
        slug: card.slug,
        order: card.order,
        title: card.title.trim(),
        text: card.text.trim(),
        congratulationsText: card.congratulationsText.trim(),
        objective: card.objective,
        startingFen,
        difficulty: card.difficulty,
        rewardGold: card.rewardGold,
        rewardScore: card.rewardScore,
        mapId: map.id,
        boardTemplateId: null,
      },
    });
  }

  return { ok: true, slug: input.slug };
}

function toDemoQuestMapSeed(map: QuestMapWithCards): DemoQuestMapSeed {
  const boardTemplates = map.cards
    .filter((card) => card.boardTemplate)
    .map((card) => ({
      slug: card.boardTemplate!.slug,
      name: card.boardTemplate!.name,
      description: "",
      fen: card.boardTemplate!.fen,
    }));

  const uniqueTemplates = new Map(boardTemplates.map((template) => [template.slug, template]));

  return {
    slug: map.slug,
    title: map.title,
    description: map.description ?? "",
    order: map.order,
    isPublished: map.isPublished,
    boardTemplates: [...uniqueTemplates.values()],
    cards: map.cards.map((card) => toDemoQuestCardSeed(card)),
  };
}

function toDemoQuestCardSeed(card: QuestMapWithCards["cards"][number]): DemoQuestCardSeed {
  const boardTemplateSlug = card.boardTemplate?.slug ?? null;

  return {
    slug: card.slug,
    order: card.order,
    title: card.title,
    text: card.text,
    congratulationsText: card.congratulationsText,
    objective: normalizeCardObjective(card.objective, { type: "checkmate" }),
    startingFen: card.startingFen,
    difficulty: card.difficulty as Difficulty,
    rewardGold: card.rewardGold,
    rewardScore: card.rewardScore,
    completed: false,
    boardTemplateSlug,
    templateName: boardTemplateSlug ? card.boardTemplate?.name ?? "Шаблон доски" : "Стандартная расстановка",
  };
}

function validateEditorMap(input: MapEditorMapInput) {
  if (!input.title.trim()) return "Укажите название карты.";
  if (input.cards.length === 0) return "Добавьте хотя бы одну карточку.";

  const slugs = new Set<string>();
  for (const card of input.cards) {
    if (slugs.has(card.slug)) return `Дублирующийся slug карточки: ${card.slug}.`;
    slugs.add(card.slug);

    if (!card.title.trim()) return `У карточки ${card.order} пустое название.`;
    if (!card.text.trim()) return `У карточки ${card.order} пустой текст.`;
    if (!card.congratulationsText.trim()) return `У карточки ${card.order} пустой текст поздравления.`;
    if (card.rewardGold <= 0 || card.rewardScore <= 0) return `У карточки ${card.order} награда должна быть больше нуля.`;
    if ((card.objective.type === "survive_half_moves" && card.objective.halfMoves <= 0) || (card.objective.type === "capture_pieces" && card.objective.pieces <= 0)) {
      return `У карточки ${card.order} цель должна иметь число больше нуля.`;
    }

    if (card.fen.trim()) {
      const validation = validateBoardTemplateFen(card.fen);
      if (!validation.ok) return `FEN карточки ${card.order} невалиден: ${validation.issues[0]?.message ?? "ошибка FEN"}`;
    }
  }

  return null;
}

async function nextMapOrder() {
  const maxOrder = await getPrisma().questMap.aggregate({ _max: { order: true } });
  return (maxOrder._max.order ?? 0) + 1;
}

async function createUniqueMapSlug(title: string) {
  const base = normalizeSlug(title) || "new-map";
  const prisma = getPrisma();
  let candidate = base;
  let suffix = 2;

  while (await prisma.questMap.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function normalizeSlug(value: string) {
  const transliterated = value
    .trim()
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => {
      const map: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
        к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
        х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
      };
      return map[char] ?? "";
    });

  return transliterated.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function resolveCardStartingFen(card: DemoQuestCardSeed, map: DemoQuestMapSeed) {
  if (card.startingFen) return card.startingFen;
  if (!card.boardTemplateSlug) return STARTING_FEN;
  return map.boardTemplates.find((template) => template.slug === card.boardTemplateSlug)?.fen ?? getCardStartingFen(card) ?? STARTING_FEN;
}
