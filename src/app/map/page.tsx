import Image from "next/image";
import Link from "next/link";
import {redirect} from "next/navigation";
import {PreBattleCard} from "@/components/pre-battle-card";
import {RightSideToast} from "@/components/right-side-toast";
import {difficultyLabel, starsForDifficulty} from "@/lib/demo-content";
import {getCurrentUser} from "@/lib/auth/session";
import {getAuthenticatedHomePath, getLoginPath} from "@/lib/routing/auth-redirect";
import {getQuestMapPageData} from "@/lib/quest/quest-data";
import {publicPath} from "@/lib/routing/public-path";

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
  const mapData = await getQuestMapPageData(user.id, params.map);
  const { current, map, maps, next, previous } = mapData;
  const stageBackground = publicPath("/wall/stage1.png");
  const coinIconSrc = publicPath("/wall/coin.png");
  const victoryIconSrc = publicPath("/wall/victory.png");
  const victoryLeafSrc = publicPath("/wall/victory_leaf2.png");
  const isMapCompleted = map.completedCards === map.cards.length;
  const showMapUnlockedMessage = Boolean(completedCardSlug && isMapCompleted && next?.isUnlocked);

  return (
    <section className="map-page stage-map-page" style={{ "--stage-background": `url(${stageBackground})` } as React.CSSProperties}>
      <div className="page-heading">
        <div className="map-heading-main">
          <div>
            {isMapCompleted ? (
              <div className="map-completed-badge">
                <Image src={victoryIconSrc} alt="" width={34} height={34} />
                <span>Пройдено</span>
              </div>
            ) : null}
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
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${map.completionPercent}%` }} />
        </div>
      </div>

      {result ? <RightSideToast message={result} /> : null}

      {showMapUnlockedMessage ? (
        <dialog className="battle-dialog map-unlocked-dialog" open aria-labelledby="map-unlocked-dialog-title">
          <div className="battle-dialog-header">
            <div className="map-unlocked-title">
              <Image src={victoryLeafSrc} alt="" width={76} height={76} />
              <div>
                <p className="eyebrow">Карта завершена</p>
                <h2 id="map-unlocked-dialog-title">Поздравляем!</h2>
              </div>
            </div>
          </div>
          <div className="map-unlocked-message">
            <p>Карта пройдена на 100%. Открыта новая карта: {next?.title}.</p>
          </div>
          <div className="dialog-actions">
            <form method="dialog">
              <button className="ghost-button" type="submit">Закрыть</button>
            </form>
            {next ? <Link className="primary-action" href={next.href}>К новой карте</Link> : null}
          </div>
        </dialog>
      ) : null}

      <div className="quest-map" aria-label="Quest battle map">
        <div className="map-path" aria-hidden="true" />
        {map.cards.map((card, index) => (
          <PreBattleCard
            alignEnd={index % 2 !== 0}
            card={card}
            difficultyLabel={difficultyLabel(card.difficulty)}
            coinIconSrc={coinIconSrc}
            highlighted={card.slug === completedCardSlug}
            key={card.slug}
            stars={"★".repeat(starsForDifficulty(card.difficulty))}
          />
        ))}
      </div>
    </section>
  );
}
