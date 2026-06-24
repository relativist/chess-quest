"use client";

import { useRouter } from "next/navigation";

type MapEditorSelectorProps = {
  maps: Array<{
    cardCount: number;
    isPublished: boolean;
    slug: string;
    title: string;
  }>;
  selectedSlug: string;
};

export function MapEditorSelector({ maps, selectedSlug }: MapEditorSelectorProps) {
  const router = useRouter();

  return (
    <div className="editor-map-selector">
      <label>
        Выбранная карта
        <select
          name="map"
          value={selectedSlug}
          onChange={(event) => router.push(`/map/editor?map=${encodeURIComponent(event.target.value)}`)}
        >
          {maps.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.title} - {item.cardCount} карточек - {item.isPublished ? "опубликована" : "черновик"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
