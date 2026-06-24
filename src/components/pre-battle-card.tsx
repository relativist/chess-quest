"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef } from "react";

type PreBattleCardProps = {
  card: {
    completed: boolean;
    difficulty: number;
    order: number;
    earnedGold: number;
    earnedScore: number;
    rewardGold: number;
    objectiveLabel: string;
    rewardScore: number;
    slug: string;
    templateName: string;
    text: string;
    wins: number;
    title: string;
  };
  difficultyLabel: string;
  enemyImageSrc: string;
  stars: string;
  alignEnd: boolean;
  highlighted?: boolean;
};

export function PreBattleCard({ card, difficultyLabel, enemyImageSrc, stars, alignEnd, highlighted = false }: PreBattleCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <article
        className={`quest-card ${card.completed ? "completed" : "locked"} ${highlighted ? "just-completed" : ""}`}
        style={{ marginLeft: alignEnd ? "auto" : "0" }}
      >
        <div className="card-status">{highlighted ? "Победа засчитана" : card.completed ? "Карточка пройдена" : "Карточка не пройдена"}</div>
        <div className="card-main">
          <span className="card-number">{card.order}</span>
          <div>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </div>
        </div>
        <div className="card-difficulty" aria-label={`Сложность: ${difficultyLabel}`}>
          <span>Сложность</span>
          <strong>{stars}</strong>
          <em>{difficultyLabel}</em>
        </div>
        <button className="primary-action" type="button" onClick={openDialog}>
          Открыть битву
        </button>
      </article>

      <dialog className="battle-dialog" ref={dialogRef} aria-labelledby={titleId}>
        <div className="enemy-dialog-art">
          <Image src={enemyImageSrc} alt="" width={520} height={220} />
        </div>
        <div className="battle-dialog-header">
          <div>
            <p className="eyebrow">Карточка {card.order}</p>
            <h2 id={titleId}>{card.title}</h2>
          </div>
        </div>

        <p className="dialog-goal">{card.text}</p>

        <dl className="dialog-stats">
          <div>
            <dt>Цель</dt>
            <dd>{card.objectiveLabel}</dd>
          </div>
          <div>
            <dt>Награда</dt>
            <dd>{card.rewardScore} очков и {card.rewardGold} золота</dd>
          </div>
          <div>
            <dt>Повторная победа</dt>
            <dd>10%: {Math.max(1, Math.floor(card.rewardScore * 0.1))} очков и {Math.max(1, Math.floor(card.rewardGold * 0.1))} золота</dd>
          </div>
          <div>
            <dt>Текущий прогресс</dt>
            <dd>{card.wins > 0 ? `${card.wins} побед · ${card.earnedScore} очков` : "Еще не побеждено"}</dd>
          </div>
          <div>
            <dt>Сложность противника</dt>
            <dd>{card.difficulty} / 8 · {difficultyLabel} · {stars}</dd>
          </div>
          <div>
            <dt>Шаблон расстановки</dt>
            <dd>{card.templateName}</dd>
          </div>
        </dl>

        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={closeDialog}>
            Назад
          </button>
          <Link className="primary-action" href={`/game/${card.slug}`}>
            Начать партию
          </Link>
        </div>
      </dialog>
    </>
  );
}
