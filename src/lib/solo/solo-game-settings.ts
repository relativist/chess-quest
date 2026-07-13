import type { Difficulty } from "@/lib/demo-seed";
import type { CardObjective } from "@/lib/quest/card-objectives";

export type SoloPlayerSide = "black" | "white";
export type SoloStartingGold = 0 | 1000 | 3000;
export type SoloSettingsSearchParams = Record<string, string | string[] | undefined>;

export const SOLO_GOLD_OPTIONS = [0, 1000, 3000] as const;
export const SOLO_OBJECTIVE_OPTIONS = [
  { label: "Поставить мат", value: "checkmate" },
  { label: "Поставить мат за N ходов", value: "checkmate_in_moves" },
  { label: "Поставить шах", value: "give_check" },
  { label: "Поставить N шахов королю", value: "give_checks" },
  { label: "Продержаться N полуходов", value: "survive_half_moves" },
  { label: "Съесть N фигур противника", value: "capture_pieces" },
] as const;

export type SoloObjectiveType = (typeof SOLO_OBJECTIVE_OPTIONS)[number]["value"];

export type SoloGameSettings = {
  difficulty: Difficulty;
  gold: SoloStartingGold;
  objective: CardObjective;
  side: SoloPlayerSide;
};

export const DEFAULT_SOLO_GAME_SETTINGS: SoloGameSettings = {
  difficulty: 4,
  gold: 0,
  objective: { type: "checkmate" },
  side: "white",
};

export function parseSoloGameSettings(params: SoloSettingsSearchParams): SoloGameSettings {
  const difficultyValue = Number(singleValue(params.difficulty));
  const difficulty = Number.isInteger(difficultyValue) && difficultyValue >= 0 && difficultyValue <= 8
    ? difficultyValue as Difficulty
    : DEFAULT_SOLO_GAME_SETTINGS.difficulty;

  const sideValue = singleValue(params.side);
  const side = sideValue === "black" || sideValue === "white"
    ? sideValue
    : DEFAULT_SOLO_GAME_SETTINGS.side;

  const goldValue = Number(singleValue(params.gold));
  const gold = SOLO_GOLD_OPTIONS.includes(goldValue as SoloStartingGold)
    ? goldValue as SoloStartingGold
    : DEFAULT_SOLO_GAME_SETTINGS.gold;

  const objectiveTypeValue = singleValue(params.objective);
  const objectiveType = SOLO_OBJECTIVE_OPTIONS.some((option) => option.value === objectiveTypeValue)
    ? objectiveTypeValue as SoloObjectiveType
    : "checkmate";
  const count = parseObjectiveCount(singleValue(params.count), defaultObjectiveCount(objectiveType));

  return {
    difficulty,
    gold,
    objective: createSoloObjective(objectiveType, count),
    side,
  };
}

export function createSoloObjective(type: SoloObjectiveType, count: number): CardObjective {
  const normalizedCount = parseObjectiveCount(String(count), defaultObjectiveCount(type));

  switch (type) {
    case "checkmate":
      return { type };
    case "checkmate_in_moves":
      return { moves: normalizedCount, type };
    case "give_check":
      return { type };
    case "give_checks":
      return { checks: normalizedCount, type };
    case "survive_half_moves":
      return { halfMoves: normalizedCount, type };
    case "capture_pieces":
      return { pieces: normalizedCount, type };
  }
}

export function getSoloObjectiveType(objective: CardObjective): SoloObjectiveType {
  return objective.type === "capture_piece" ? "capture_pieces" : objective.type;
}

export function getSoloObjectiveCount(objective: CardObjective) {
  switch (objective.type) {
    case "checkmate_in_moves":
      return objective.moves;
    case "give_checks":
      return objective.checks;
    case "survive_half_moves":
      return objective.halfMoves;
    case "capture_pieces":
      return objective.pieces;
    case "capture_piece":
      return 1;
    default:
      return 1;
  }
}

export function soloGameHref(settings: SoloGameSettings) {
  return "/solo/game?" + serializeSoloGameSettings(settings).toString();
}

export function soloSettingsHref(settings: SoloGameSettings) {
  return "/solo?" + serializeSoloGameSettings(settings).toString();
}

export function serializeSoloGameSettings(settings: SoloGameSettings) {
  const params = new URLSearchParams({
    difficulty: String(settings.difficulty),
    gold: String(settings.gold),
    objective: getSoloObjectiveType(settings.objective),
    side: settings.side,
  });

  const objectiveType = getSoloObjectiveType(settings.objective);
  if (objectiveType !== "checkmate" && objectiveType !== "give_check") {
    params.set("count", String(getSoloObjectiveCount(settings.objective)));
  }

  return params;
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseObjectiveCount(value: string | undefined, fallback: number) {
  const count = Number(value);
  if (!Number.isFinite(count)) return fallback;
  return Math.min(99, Math.max(1, Math.floor(count)));
}

function defaultObjectiveCount(type: SoloObjectiveType) {
  if (type === "checkmate_in_moves") return 3;
  if (type === "survive_half_moves") return 8;
  return 3;
}
