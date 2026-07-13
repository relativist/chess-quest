import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChessGameClient } from "@/components/chess-game-client";
import { difficultyLabel, starsForDifficulty } from "@/lib/demo-content";
import { getCurrentUser } from "@/lib/auth/session";
import { STARTING_FEN } from "@/lib/chess/fen-validation";
import { describeCardObjective, objectiveShortLabel } from "@/lib/quest/card-objectives";
import { getAuthenticatedHomePath, getLoginPath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";
import {
  parseSoloGameSettings,
  soloSettingsHref,
  type SoloSettingsSearchParams,
} from "@/lib/solo/solo-game-settings";

type SoloGamePageProps = {
  searchParams: Promise<SoloSettingsSearchParams>;
};

export default async function SoloGamePage({ searchParams }: SoloGamePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(getLoginPath("Зарегистрируйтесь или войдите, чтобы играть."));
  if (user.role === "MAP_EDITOR") redirect(getAuthenticatedHomePath(user));

  const settings = parseSoloGameSettings(await searchParams);
  const objectiveLabel = objectiveShortLabel(settings.objective);
  const stageBackground = publicPath("/assets/images/backgrounds/main-wall.png");

  return (
    <section className="game-page battle-stage-page" style={{ "--stage-background": "url(" + stageBackground + ")" } as React.CSSProperties}>
      <div className="game-layout">
        <div className="game-play-column">
          <header className="battle-heading">
            <div className="battle-heading-top-row">
              <Link className="battle-heading-back" href={soloSettingsHref(settings)} aria-label="Назад к настройкам одиночной игры" title="Назад к настройкам">
                <Image src={publicPath("/assets/images/icons/back.png")} alt="" width={58} height={58} priority />
              </Link>
              <div className="battle-heading-title">
                <Image className="battle-heading-icon" src={publicPath("/assets/images/icons/battle.png")} alt="" width={72} height={72} priority />
                <h1>Одиночный поединок</h1>
              </div>
            </div>
            <details className="battle-description">
              <summary>Описание битвы</summary>
              <p className="battle-heading-copy">Тренировочная битва против Stockfish с выбранной сложностью, стороной, запасом магии и целью победы.</p>
            </details>
            <p className="battle-heading-objective">Цель: {describeCardObjective(settings.objective)}</p>
          </header>

          <ChessGameClient
            backIconSrc={publicPath("/assets/images/icons/back.png")}
            cardDifficultyLabel={difficultyLabel(settings.difficulty)}
            cardSlug="solo"
            cardStars={"★".repeat(starsForDifficulty(settings.difficulty))}
            cardTitle="Одиночный поединок"
            checkSoundSrc={publicPath("/assets/audio/sfx/check.mp3")}
            chessBoardIconSrc={publicPath("/assets/images/icons/chess-board.png")}
            chestIconSrc={publicPath("/assets/images/icons/chest.png")}
            clueIconSrc={publicPath("/assets/images/icons/clue.png")}
            coinIconSrc={publicPath("/assets/images/icons/coin2.png")}
            congratulationsText="Поздравляем! Цель одиночной партии выполнена. Результат не влияет на рейтинг и сундук кампании."
            captureSoundSrc={publicPath("/assets/audio/sfx/capture.mp3")}
            defeatedEnemyImageSrc={publicPath("/assets/images/battle/defeated-enemy.png")}
            defeatedHeroImageSrc={publicPath("/assets/images/battle/defeated-hero.png")}
            defeatSoundSrc={publicPath("/assets/audio/music/defeat1.mp3")}
            difficulty={settings.difficulty}
            difficultyIconSrc={publicPath("/assets/images/icons/difficulty.png")}
            exitHref={soloSettingsHref(settings)}
            exitLabel="К настройкам"
            gameMode="solo"
            gameStateIconSrc={publicPath("/assets/images/icons/game-state.png")}
            initialFen={STARTING_FEN}
            magicIconSrc={publicPath("/assets/images/icons/magic.png")}
            objective={settings.objective}
            objectiveIconSrc={publicPath("/assets/images/icons/objective.png")}
            objectiveLabel={objectiveLabel}
            playerGold={settings.gold}
            playerSide={settings.side}
            resetIconSrc={publicPath("/assets/images/icons/renew.png")}
            rewardGold={0}
            rewardScore={0}
            scoreIconSrc={publicPath("/assets/images/icons/score.png")}
            stepSoundSrc={publicPath("/assets/audio/music/step1.mp3")}
            stockfishWorkerSrc={publicPath("/stockfish/stockfish-18-lite-single.js")}
            winSoundSrc={publicPath("/assets/audio/music/win1.mp3")}
          />
        </div>
      </div>
    </section>
  );
}
