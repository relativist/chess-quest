import type { PrismaClient } from "@/generated/prisma/client";
import { demoMapSeeds, getCardStartingFen, validateDemoSeedData, type DemoQuestMapSeed } from "@/lib/demo-seed";

export async function seedDemoMap(client: PrismaClient) {
  await seedDemoMaps(client);
}

export async function seedDemoMaps(client: PrismaClient) {
  const validation = validateDemoSeedData();
  if (!validation.ok) {
    throw new Error("Demo seed data is invalid:\n" + validation.issues.join("\n"));
  }

  await moveCustomMapsAfterBuiltIns(client);

  for (const mapSeed of demoMapSeeds) {
    await seedOneMap(client, mapSeed);
  }
}

export async function moveCustomMapsAfterBuiltIns(client: PrismaClient) {
  const builtInSlugs = demoMapSeeds.map((map) => map.slug);
  const customMaps = await client.questMap.findMany({
    where: { slug: { notIn: builtInSlugs } },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  for (const [index, map] of customMaps.entries()) {
    await client.questMap.update({
      where: { id: map.id },
      data: { order: -100000 - index },
    });
  }

  for (const [index, map] of customMaps.entries()) {
    await client.questMap.update({
      where: { id: map.id },
      data: { order: demoMapSeeds.length + index + 1 },
    });
  }
}

async function seedOneMap(client: PrismaClient, mapSeed: DemoQuestMapSeed) {
  const templatesBySlug = new Map<string, { id: string }>();

  for (const template of mapSeed.boardTemplates) {
    const savedTemplate = await client.boardTemplate.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        description: template.description,
        fen: template.fen,
      },
      create: {
        slug: template.slug,
        name: template.name,
        description: template.description,
        fen: template.fen,
      },
      select: { id: true },
    });

    templatesBySlug.set(template.slug, savedTemplate);
  }

  const map = await client.questMap.upsert({
    where: { slug: mapSeed.slug },
    update: {
      title: mapSeed.title,
      description: mapSeed.description,
      order: mapSeed.order,
      isPublished: mapSeed.isPublished,
    },
    create: {
      slug: mapSeed.slug,
      title: mapSeed.title,
      description: mapSeed.description,
      order: mapSeed.order,
      isPublished: mapSeed.isPublished,
    },
    select: { id: true },
  });

  for (const card of mapSeed.cards) {
    const templateId = card.boardTemplateSlug ? templatesBySlug.get(card.boardTemplateSlug)?.id : null;
    const startingFen = card.startingFen ?? (card.boardTemplateSlug ? null : getCardStartingFen(card)) ?? null;

    if (card.boardTemplateSlug && !templateId) {
      throw new Error(`Missing board template for card ${card.slug}: ${card.boardTemplateSlug}`);
    }

    await client.questCard.upsert({
      where: { slug: card.slug },
      update: {
        order: card.order,
        title: card.title,
        text: card.text,
        congratulationsText: card.congratulationsText,
        objective: card.objective ?? { type: "checkmate" },
        startingFen,
        difficulty: card.difficulty,
        rewardGold: card.rewardGold,
        rewardScore: card.rewardScore,
        mapId: map.id,
        boardTemplateId: templateId,
      },
      create: {
        slug: card.slug,
        order: card.order,
        title: card.title,
        text: card.text,
        congratulationsText: card.congratulationsText,
        objective: card.objective ?? { type: "checkmate" },
        startingFen,
        difficulty: card.difficulty,
        rewardGold: card.rewardGold,
        rewardScore: card.rewardScore,
        mapId: map.id,
        boardTemplateId: templateId,
      },
    });
  }
}
