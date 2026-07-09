import {ChessGameClient} from "@/components/chess-game-client";
import {completeCardAction, grantSecretGoldAction, spendMagicGoldAction} from "@/app/game/[cardId]/actions";
import Image from "next/image";
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
  const stageBackground = publicPath("/wall/main_wall.png");

  return (
    <section className="game-page battle-stage-page" style={{ "--stage-background": `url(${stageBackground})` } as React.CSSProperties}>
      <div className="game-layout">
        <div className="game-play-column">
          <header className="battle-heading">
            <div className="battle-heading-title">
              <Image className="battle-heading-icon" src={publicPath("/wall/1/battle.png")} alt="" width={72} height={72} priority />
              <h1>{card.title}</h1>
            </div>
            <details className="battle-description">
              <summary>Описание карточки</summary>
              <p className="battle-heading-copy">{battleText}</p>
            </details>
            <p className="battle-heading-objective">Цель: {card.objectiveLabel}</p>
          </header>

          <ChessGameClient
            cardDifficultyLabel={difficultyLabel(card.difficulty)}
            cardSlug={card.slug}
            cardStars={"★".repeat(starsForDifficulty(card.difficulty))}
            backIconSrc={publicPath("/wall/1/back.png")}
            cardTitle={card.title}
            chessBoardIconSrc={publicPath("/wall/1/chess-board.png")}
            chestIconSrc={publicPath("/wall/1/chest.png")}
            checkSoundSrc={publicPath("/wall/check.mp3")}
            completeCardAction={completeCardAction}
            congratulationsText={card.congratulationsText}
            captureSoundSrc={publicPath("/wall/eat.mp3")}
            clueIconSrc={publicPath("/wall/1/clue.png")}
            coinIconSrc={publicPath("/wall/1/coin2.png")}
            defeatedEnemyImageSrc={publicPath("/wall/defeated-enemy-stage1-transparent.png")}
            defeatedHeroImageSrc={publicPath("/wall/defeted-hero-transparent.png")}
            defeatSoundSrc={publicPath("/music/defeat1.mp3")}
            difficulty={card.difficulty}
            difficultyIconSrc={publicPath("/wall/1/difficulty.png")}
            gameStateIconSrc={publicPath("/wall/1/game-state.png")}
            grantSecretGoldAction={grantSecretGoldAction}
            initialFen={card.startingFen}
            magicIconSrc={publicPath("/wall/1/magic.png")}
            objective={card.objective}
            objectiveIconSrc={publicPath("/wall/1/objective.png")}
            objectiveLabel={card.objectiveLabel}
            playerGold={map.playerGold}
            playerSide={card.sideToMove}
            rewardGold={card.rewardGold}
            resetIconSrc={publicPath("/wall/1/renew.png")}
            rewardScore={card.rewardScore}
            scoreIconSrc={publicPath("/wall/1/score.png")}
            spendMagicGoldAction={spendMagicGoldAction}
            stepSoundSrc={publicPath("/music/step1.mp3")}
            stockfishWorkerSrc={publicPath("/stockfish/stockfish-18-lite-single.js")}
            winSoundSrc={publicPath("/music/win1.mp3")}
          />
        </div>
      </div>
    </section>
  );
}
