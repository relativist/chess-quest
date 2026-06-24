import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { demoMapSeeds } from "@/lib/demo-seed";
import { seedDemoMap } from "@/lib/quest/seed-demo-map";

let ensurePromise: Promise<void> | null = null;

export async function ensureQuestDataReady() {
  if (!isDatabaseConfigured()) return;

  if (!ensurePromise) {
    ensurePromise = ensureDemoMapExists(getPrisma()).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}

export async function ensureDemoMapExists(client: PrismaClient) {
  const existingMaps = await client.questMap.findMany({
    where: { slug: { in: demoMapSeeds.map((map) => map.slug) } },
    select: { slug: true },
  });

  if (existingMaps.length === demoMapSeeds.length) return;

  await seedDemoMap(client);
}
