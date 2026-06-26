import { redirect } from "next/navigation";
import { CardFenEditor } from "@/components/card-fen-editor";
import { MapEditorSelector } from "@/components/map-editor-selector";
import { createMapAction } from "@/app/map/editor/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { demoMapSeed } from "@/lib/demo-seed";
import { getQuestMapRecordBySlug, listQuestMapsForEditor, resolveCardStartingFen } from "@/lib/quest/quest-repository";
import { getLoginPath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";

type MapEditorPageProps = {
  searchParams: Promise<{ map?: string }>;
};

export default async function MapEditorPage({ searchParams }: MapEditorPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(publicPath(getLoginPath("Войдите как map:map для редактирования карты.")));
  if (user.role !== "MAP_EDITOR") redirect(publicPath("/map"));

  const params = await searchParams;
  const maps = await listQuestMapsForEditor();
  const selectedSlug = params.map ?? maps[0]?.slug ?? demoMapSeed.slug;
  const map = (await getQuestMapRecordBySlug(selectedSlug)) ?? (await getQuestMapRecordBySlug(demoMapSeed.slug));

  if (!map) {
    redirect(`/map/editor?map=${encodeURIComponent(demoMapSeed.slug)}`);
  }

  const cards = map.cards.map((card) => ({
    ...card,
    initialFen: resolveCardStartingFen(card, map),
  }));

  const editorBackground = publicPath("/wall/editor.png");

  return (
    <section className="map-page editor-background-page" style={{ "--editor-background": `url(${editorBackground})` } as React.CSSProperties}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Редактор карт</p>
          <h1>Карты квеста</h1>
          <p className="page-description">Создавайте карты и карточки битв.</p>
        </div>
        <form action={createMapAction}>
          <label className="create-map-field">
            Название новой карты
            <input name="title" placeholder="Например, Башня мастеров" required type="text" />
          </label>
          <button className="primary-action" type="submit">+ Новая карта</button>
        </form>
      </div>

      <MapEditorSelector maps={maps} selectedSlug={map.slug} />

      <CardFenEditor
        key={map.slug}
        cards={cards}
        mapDescription={map.description}
        mapIsPublished={map.isPublished}
        mapSlug={map.slug}
        mapTitle={map.title}
      />
    </section>
  );
}
