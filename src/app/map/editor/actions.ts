"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDatabaseUser } from "@/lib/auth/database-user";
import { getCurrentUser } from "@/lib/auth/session";
import { createQuestMap, saveQuestMapFromEditor, type MapEditorMapInput } from "@/lib/quest/quest-repository";

async function requireMapEditor() {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?mode=login&error=${encodeURIComponent("Войдите как map:map для редактирования карты.")}`);
  if (user.role !== "MAP_EDITOR") redirect("/map");
  return user;
}

export async function saveMapEditorAction(input: MapEditorMapInput) {
  const user = await requireMapEditor();
  await ensureDatabaseUser(user);
  const result = await saveQuestMapFromEditor(input, user.id);

  if (!result.ok) return result;

  revalidatePath("/map");
  revalidatePath("/map/editor");
  revalidatePath(`/game/[cardId]`, "page");

  return result;
}

export async function createMapAction(formData: FormData) {
  const user = await requireMapEditor();
  await ensureDatabaseUser(user);
  const title = String(formData.get("title") ?? "").trim() || "Новая карта";
  const map = await createQuestMap(title, user.id);

  revalidatePath("/map/editor");
  redirect(`/map/editor?map=${encodeURIComponent(map.slug)}`);
}
