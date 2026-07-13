import {ChessGameClient} from "@/components/chess-game-client";
import {completeCardAction, grantSecretGoldAction, spendMagicGoldAction, spendUndoGoldAction} from "@/app/game/[cardId]/actions";
import Image from "next/image";
import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth/session";
import {difficultyLabel, starsForDifficulty} from "@/lib/demo-content";
import {getCurrentQuestMap, getGameCardById} from "@/lib/quest/quest-data";
import {publicPath} from "@/lib/routing/public-path";

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

  const battleText = card.text.replaceAll("FEN", "стартовой позиции");
  const stageBackground = publicPath("/assets/images/backgrounds/main-wall.png");
  const mapHref = "/map?map=" + encodeURIComponent(map.slug);

  return (
    <section className="game-page battle-stage-page" style={{ "--stage-background": `url(${stageBackground})` } as React.CSSProperties}>
      <div className="game-layout">
        <div className="game-play-column">
          <header className="battle-heading">
            <div className="battle-heading-top-row">
              <Link className="battle-heading-back" href={mapHref} aria-label="Назад на карту" title="Назад на карту">
                <Image src={publicPath("/assets/images/icons/back.png")} alt="" width={58} height={58} priority />
              </Link>
              <div className="battle-heading-title">
                <Image className="battle-heading-icon" src={publicPath("/assets/images/icons/battle.png")} alt="" width={72} height={72} priority />
                <h1>{card.title}</h1>
              </div>
            </div>
            <details className="battle-description">
              <summary>Описание карточки</summary>
              <p className="battle-heading-copy">{battleText}</p>
            </details>
            <div id="battle-objective-progress" />
          </header>

          <ChessGameClient
            cardDifficultyLabel={difficultyLabel(card.difficulty)}
            cardSlug={card.slug}
            cardStars={"★".repeat(starsForDifficulty(card.difficulty))}
            backIconSrc={publicPath("/assets/images/icons/back.png")}
            cardTitle={card.title}
            chessBoardIconSrc={publicPath("/assets/images/icons/chess-board.png")}
            chestIconSrc={publicPath("/assets/images/icons/chest.png")}
            checkSoundSrc={publicPath("/assets/audio/sfx/check.mp3")}
            completeCardAction={completeCardAction}
            congratulationsText={card.congratulationsText}
            captureSoundSrc={publicPath("/assets/audio/sfx/capture.mp3")}
            clueIconSrc={publicPath("/assets/images/icons/clue.png")}
            coinIconSrc={publicPath("/assets/images/icons/coin2.png")}
            defeatedEnemyImageSrc={publicPath("/assets/images/battle/defeated-enemy.png")}
            defeatedHeroImageSrc={publicPath("/assets/images/battle/defeated-hero.png")}
            defeatSoundSrc={publicPath("/assets/audio/music/defeat1.mp3")}
            difficulty={card.difficulty}
            difficultyIconSrc={publicPath("/assets/images/icons/difficulty.png")}
            gameStateIconSrc={publicPath("/assets/images/icons/game-state.png")}
            grantSecretGoldAction={grantSecretGoldAction}
            initialFen={card.startingFen}
            magicIconSrc={publicPath("/assets/images/icons/magic.png")}
            objective={card.objective}
            objectiveIconSrc={publicPath("/assets/images/icons/objective.png")}
            objectiveLabel={card.objectiveLabel}
            objectiveProgressTargetId="battle-objective-progress"
            playerGold={map.playerGold}
            playerSide={card.sideToMove}
            rewardGold={card.rewardGold}
            resetIconSrc={publicPath("/assets/images/icons/renew.png")}
            rewardScore={card.rewardScore}
            scoreIconSrc={publicPath("/assets/images/icons/score.png")}
            showObjectiveProgress
            spendMagicGoldAction={spendMagicGoldAction}
            spendUndoGoldAction={spendUndoGoldAction}
            stepSoundSrc={publicPath("/assets/audio/music/step1.mp3")}
            stockfishWorkerSrc={publicPath("/stockfish/stockfish-18-lite-single.js")}
            winSoundSrc={publicPath("/assets/audio/music/win1.mp3")}
          />
        </div>
      </div>
    </section>
  );
}
