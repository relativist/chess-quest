"use client";

import Image from "next/image";
import Link from "next/link";

type PreBattleCardProps = {
  card: {
    completed: boolean;
    difficulty: number;
    order: number;
    earnedGold: number;
    earnedScore: number;
    rewardGold: number;
    displayRewardGold: number;
    objectiveLabel: string;
    rewardScore: number;
    slug: string;
    templateName: string;
    text: string;
    wins: number;
    title: string;
  };
  difficultyLabel: string;
  coinIconSrc: string;
  stars: string;
  alignEnd: boolean;
  highlighted?: boolean;
};

export function PreBattleCard({ card, difficultyLabel, coinIconSrc, stars, alignEnd, highlighted = false }: PreBattleCardProps) {
  const statusLabel = highlighted ? "победа засчитана" : card.completed ? "пройдена" : "не пройдена";
  const rewardLabel = (card.completed ? "Повторная награда " : "Награда ") + card.displayRewardGold + " монет";

  return (
    <Link
      className={`quest-card ${card.completed ? "completed" : "locked"} ${highlighted ? "just-completed" : ""}`}
      href={`/game/${card.slug}`}
      style={{ marginLeft: alignEnd ? "auto" : "0" }}
      aria-label={"Открыть битву. Карточка " + card.order + ": " + card.title + ", " + statusLabel + ". Сложность: " + difficultyLabel}
    >
      <span className="card-reward-badge" aria-label={rewardLabel}>
        <span>{card.displayRewardGold}</span>
        <Image className="coin-icon" src={coinIconSrc} alt="монеты" width={18} height={18} />
      </span>
      <span className="card-stars" aria-label={"Сложность: " + difficultyLabel}>{stars}</span>
      <span className="card-title">{card.title}</span>
      <span className="card-description">{card.text}</span>
    </Link>
  );
}
