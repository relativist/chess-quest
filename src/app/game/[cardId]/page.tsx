import Image from "next/image";
import Link from "next/link";
import { ChessGameClient } from "@/components/chess-game-client";
import { completeCardAction, spendMagicGoldAction } from "@/app/game/[cardId]/actions";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { difficultyLabel, starsForDifficulty } from "@/lib/demo-content";
import { getCurrentQuestMap, getGameCardById } from "@/lib/quest/quest-data";
import { publicPath } from "@/lib/routing/public-path";

type GamePageProps = {
  params: Promise<{ cardId: string }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?mode=login&error=${encodeURIComponent("Зарегистрируйтесь или войдите, чтобы играть.")}`);

  const { cardId } = await params;
  const [card, map] = await Promise.all([getGameCardById(cardId), getCurrentQuestMap(user.id)]);

  if (!card) {
    notFound();
  }

  const sideToMoveLabel = card.sideToMove === "white" ? "Белые" : "Черные";
  const battleText = card.text.replaceAll("FEN", "стартовой позиции");
  const stageBackground = publicPath("/wall/stage1.png");

  return (
    <section className="game-page battle-stage-page" style={{ "--stage-background": `url(${stageBackground})` } as React.CSSProperties}>
      <div className="game-toolbar">
        <Link className="secondary-link map-back-link" href="/map" title="Назад к карте">
          <Image src={publicPath("/wall/map-icon.png")} alt="" width={28} height={28} />
          <span>Карта</span>
        </Link>
        <div className="engine-pill">Stockfish Web Worker: включен</div>
      </div>

      <div className="game-layout">
        <div className="game-play-column">
          <header className="battle-heading">
            <h1>{card.title}</h1>
            <p>{battleText}</p>
          </header>

          <ChessGameClient
            cardDifficultyLabel={difficultyLabel(card.difficulty)}
            cardOrder={card.order}
            cardSlug={card.slug}
            cardStars={"★".repeat(starsForDifficulty(card.difficulty))}
            backIconSrc={publicPath("/wall/back.png")}
            cardTitle={card.title}
            completeCardAction={completeCardAction}
            congratulationsText={card.congratulationsText}
            coinIconSrc={publicPath("/wall/coin.png")}
            defeatedEnemyImageSrc={publicPath("/wall/defeated-enemy-stage1-transparent.png")}
            defeatedHeroImageSrc={publicPath("/wall/defeted-hero-transparent.png")}
            defeatSoundSrc={publicPath("/music/defeat1.mp3")}
            difficulty={card.difficulty}
            initialFen={card.startingFen}
            objective={card.objective}
            objectiveLabel={card.objectiveLabel}
            playerGold={map.earnedGold}
            playerSide={card.sideToMove}
            rewardGold={card.rewardGold}
            resetIconSrc={publicPath("/wall/reset.png")}
            rewardScore={card.rewardScore}
            sideToMoveLabel={sideToMoveLabel}
            spendMagicGoldAction={spendMagicGoldAction}
            stepSoundSrc={publicPath("/music/step1.mp3")}
            stockfishWorkerSrc={publicPath("/stockfish/stockfish-18-lite-single.js")}
            templateName={card.templateName}
            winSoundSrc={publicPath("/music/win1.mp3")}
          />
        </div>
      </div>
    </section>
  );
}
