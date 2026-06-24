"use server";

import { redirect } from "next/navigation";
import { ensureDatabaseUser } from "@/lib/auth/database-user";
import { getCurrentUser } from "@/lib/auth/session";
import { getMagicUpgradeById } from "@/lib/quest/magic-upgrades";
import { markCardVictory, spendUserGold, type SpendGoldResult } from "@/lib/quest/progress-store";
import { getGameCardById } from "@/lib/quest/quest-data";

export type SpendMagicGoldResult = SpendGoldResult & {
  error?: string;
};

export async function completeCardAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?mode=login&error=${encodeURIComponent("Зарегистрируйтесь или войдите, чтобы играть.")}`);

  const cardSlug = String(formData.get("cardSlug") ?? "");
  const card = await getGameCardById(cardSlug);
  if (!card) redirect("/map");

  await ensureDatabaseUser(user);
  const result = await markCardVictory(user.id, card);
  const resultText = result.isFirstWin
    ? `Победа: +${result.awardedScore} очков, +${result.awardedGold} золота.`
    : `Повторная победа: +${result.awardedScore} очков, +${result.awardedGold} золота.`;

  redirect(`/map?map=${encodeURIComponent(card.mapSlug)}&completed=${encodeURIComponent(card.slug)}&result=${encodeURIComponent(resultText)}`);
}

export async function spendMagicGoldAction(formData: FormData): Promise<SpendMagicGoldResult> {
  const user = await getCurrentUser();
  if (!user) return { availableGold: 0, error: "Зарегистрируйтесь или войдите, чтобы использовать магию.", ok: false };

  const magicId = String(formData.get("magicId") ?? "");
  const magic = getMagicUpgradeById(magicId);
  if (!magic) return { availableGold: 0, error: "Неизвестная магия.", ok: false };

  await ensureDatabaseUser(user);
  const result = await spendUserGold(user.id, magic.costGold);
  if (!result.ok) {
    return {
      ...result,
      error: "Не хватает монет для этой магии.",
    };
  }

  return result;
}
