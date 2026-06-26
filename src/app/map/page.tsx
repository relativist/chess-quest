import Link from "next/link";
import { redirect } from "next/navigation";
import { PreBattleCard } from "@/components/pre-battle-card";
import { RightSideToast } from "@/components/right-side-toast";
import { UsersLeaderboardModal } from "@/components/users-leaderboard-modal";
import { difficultyLabel, starsForDifficulty } from "@/lib/demo-content";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath, getLoginPath } from "@/lib/routing/auth-redirect";
import { NEXT_MAP_UNLOCK_PERCENT } from "@/lib/quest/map-unlock";
import { getQuestMapPageData } from "@/lib/quest/quest-data";
import { getUsersLeaderboard } from "@/lib/quest/leaderboard";
import { publicPath } from "@/lib/routing/public-path";

type MapPageProps = {
  searchParams: Promise<{ completed?: string; map?: string; result?: string }>;
};

export default async function MapPage({ searchParams }: MapPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(getLoginPath("Зарегистрируйтесь или войдите, чтобы играть."));
  if (user.role === "MAP_EDITOR") redirect(getAuthenticatedHomePath(user));

  const params = await searchParams;
  const result = params.result ? decodeURIComponent(params.result) : "";
  const completedCardSlug = params.completed ? decodeURIComponent(params.completed) : "";
  const [mapData, leaderboardUsers] = await Promise.all([getQuestMapPageData(user.id, params.map), getUsersLeaderboard()]);
  const { current, map, maps, next, previous } = mapData;
  const stageBackground = publicPath("/wall/stage1.png");
  const enemyImageSrc = publicPath("/wall/enemy-stage1-transparent.png");

  return (
    <section className="map-page stage-map-page" style={{ "--stage-background": `url(${stageBackground})` } as React.CSSProperties}>
      <div className="page-heading">
        <div className="map-heading-main">
          <div>
            <p className="eyebrow">Локация {map.order}</p>
            <h1>{map.title}</h1>
            <p className="page-description">{map.description}</p>
            <nav className="map-switcher" aria-label="Переключение карт">
              {previous ? (
                <Link className="map-switcher-button" href={previous.href} aria-label={`Предыдущая карта: ${previous.title}`}>{"<"}</Link>
              ) : (
                <span className="map-switcher-button disabled" aria-hidden="true">{"<"}</span>
              )}
              <span>Карта {current.order} / {maps.length}</span>
              {next ? (
                next.isUnlocked ? (
                  <Link className="map-switcher-button" href={next.href} aria-label={`Следующая карта: ${next.title}`}>{">"}</Link>
                ) : (
                  <span className="map-switcher-button disabled" title="Следующая карта закрыта" aria-hidden="true">{">"}</span>
                )
              ) : (
                <span className="map-switcher-button disabled" aria-hidden="true">{">"}</span>
              )}
            </nav>
          </div>
          <div className="map-player-info">
            <div className="page-actions">
              <UsersLeaderboardModal currentUserId={user?.id} users={leaderboardUsers} />
            </div>
            <dl className="map-reward-summary" aria-label="Награды игрока">
              <div>
                <dt>Золото</dt>
                <dd>{map.earnedGold}</dd>
              </div>
              <div>
                <dt>Победы</dt>
                <dd>{map.totalWins}</dd>
              </div>
              <div>
                <dt>Карточки</dt>
                <dd>{map.completedCards} / {map.cards.length}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${map.completionPercent}%` }} />
          <i style={{ left: `${NEXT_MAP_UNLOCK_PERCENT}%` }} />
        </div>
      </div>

      {result ? <RightSideToast message={result} /> : null}

      <div className="quest-map" aria-label="Quest battle map">
        <div className="map-path" aria-hidden="true" />
        {map.cards.map((card, index) => (
          <PreBattleCard
            alignEnd={index % 2 !== 0}
            card={card}
            difficultyLabel={difficultyLabel(card.difficulty)}
            enemyImageSrc={enemyImageSrc}
            highlighted={card.slug === completedCardSlug}
            key={card.slug}
            stars={"★".repeat(starsForDifficulty(card.difficulty))}
          />
        ))}
      </div>
    </section>
  );
}
