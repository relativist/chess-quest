"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ENGINE_DIFFICULTY_LEVELS } from "@/lib/chess/engine-difficulty";
import {
  createSoloObjective,
  getSoloObjectiveCount,
  getSoloObjectiveType,
  SOLO_GOLD_OPTIONS,
  SOLO_OBJECTIVE_OPTIONS,
  soloGameHref,
  type SoloGameSettings,
  type SoloObjectiveType,
  type SoloPlayerSide,
  type SoloStartingGold,
} from "@/lib/solo/solo-game-settings";

type SoloSettingsFormProps = {
  backIconSrc: string;
  battleIconSrc: string;
  initialSettings: SoloGameSettings;
};

export function SoloSettingsForm({ backIconSrc, battleIconSrc, initialSettings }: SoloSettingsFormProps) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState(initialSettings.difficulty);
  const [side, setSide] = useState<SoloPlayerSide>(initialSettings.side);
  const [gold, setGold] = useState<SoloStartingGold>(initialSettings.gold);
  const [objectiveType, setObjectiveType] = useState<SoloObjectiveType>(() => getSoloObjectiveType(initialSettings.objective));
  const [objectiveCount, setObjectiveCount] = useState(() => getSoloObjectiveCount(initialSettings.objective));

  function startGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(soloGameHref({
      difficulty,
      gold,
      objective: createSoloObjective(objectiveType, objectiveCount),
      side,
    }));
  }

  const needsObjectiveCount = objectiveType !== "checkmate" && objectiveType !== "give_check";
  const countLabel = objectiveType === "checkmate_in_moves"
    ? "Ходов"
    : objectiveType === "give_checks"
      ? "Шахов"
      : objectiveType === "survive_half_moves"
        ? "Полуходов"
        : "Фигур";

  return (
    <form className="solo-settings-form" onSubmit={startGame}>
      <label>
        Сложность движка
        <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value) as SoloGameSettings["difficulty"])}>
          {Object.values(ENGINE_DIFFICULTY_LEVELS).map((level) => (
            <option key={level.difficulty} value={level.difficulty}>
              {level.difficulty} — {level.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Сторона</legend>
        <div className="solo-radio-grid two-columns">
          {([
            ["white", "Белые"],
            ["black", "Чёрные"],
          ] as const).map(([value, label]) => (
            <label className={side === value ? "solo-radio-card selected" : "solo-radio-card"} key={value}>
              <input
                checked={side === value}
                name="side"
                type="radio"
                value={value}
                onChange={() => setSide(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Доступное золото для магии</legend>
        <div className="solo-radio-grid three-columns">
          {SOLO_GOLD_OPTIONS.map((value) => (
            <label className={gold === value ? "solo-radio-card selected" : "solo-radio-card"} key={value}>
              <input
                checked={gold === value}
                name="gold"
                type="radio"
                value={value}
                onChange={() => setGold(value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
        <p className="solo-field-note">Это временное золото действует только в одной solo-партии и не связано с сундуком кампании.</p>
      </fieldset>

      <div className="solo-objective-row">
        <label>
          Цель победы
          <select value={objectiveType} onChange={(event) => setObjectiveType(event.target.value as SoloObjectiveType)}>
            {SOLO_OBJECTIVE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {needsObjectiveCount ? (
          <label>
            {countLabel}
            <input
              max={99}
              min={1}
              type="number"
              value={objectiveCount}
              onChange={(event) => setObjectiveCount(Number(event.target.value))}
            />
          </label>
        ) : null}
      </div>

      <div className="solo-settings-actions">
        <Link className="ghost-button solo-back-button" href="/start">
          <Image src={backIconSrc} alt="" width={42} height={42} />
          <span>Назад к выбору</span>
        </Link>
        <button className="solo-start-button" type="submit">
          <Image src={battleIconSrc} alt="" width={52} height={52} />
          <span>Начать битву</span>
        </button>
      </div>
    </form>
  );
}
