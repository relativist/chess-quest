import type { Difficulty } from "@/lib/demo-seed";

export type EngineDifficultyLevel = {
  difficulty: Difficulty;
  label: string;
  stars: 1 | 2 | 3 | 4 | 5;
  skillLevel: number;
  uciElo: number;
  moveTimeMs: number;
  description: string;
};

export const ENGINE_DIFFICULTY_LEVELS: Record<Difficulty, EngineDifficultyLevel> = {
  0: {
    difficulty: 0,
    label: "Новичок",
    stars: 1,
    skillLevel: 0,
    uciElo: 1320,
    moveTimeMs: 250,
    description: "Очень слабая игра для первых партий.",
  },
  1: {
    difficulty: 1,
    label: "Слабый любитель",
    stars: 1,
    skillLevel: 2,
    uciElo: 1400,
    moveTimeMs: 350,
    description: "Ошибается часто, но уже видит простые угрозы.",
  },
  2: {
    difficulty: 2,
    label: "Любитель",
    stars: 2,
    skillLevel: 5,
    uciElo: 1550,
    moveTimeMs: 500,
    description: "Любительский уровень с базовой тактикой.",
  },
  3: {
    difficulty: 3,
    label: "Третий-второй разряд",
    stars: 2,
    skillLevel: 7,
    uciElo: 1700,
    moveTimeMs: 650,
    description: "Уверенно наказывает грубые ошибки.",
  },
  4: {
    difficulty: 4,
    label: "Второй-первый разряд",
    stars: 3,
    skillLevel: 10,
    uciElo: 1850,
    moveTimeMs: 850,
    description: "Середина шкалы для регулярной тренировки.",
  },
  5: {
    difficulty: 5,
    label: "Первый разряд / КМС",
    stars: 3,
    skillLevel: 12,
    uciElo: 2000,
    moveTimeMs: 1050,
    description: "Сильный клубный соперник.",
  },
  6: {
    difficulty: 6,
    label: "КМС+",
    stars: 4,
    skillLevel: 15,
    uciElo: 2150,
    moveTimeMs: 1250,
    description: "Играет заметно точнее в тактике и защите.",
  },
  7: {
    difficulty: 7,
    label: "Мастер",
    stars: 4,
    skillLevel: 18,
    uciElo: 2350,
    moveTimeMs: 1450,
    description: "Мастерский уровень для сложных карточек.",
  },
  8: {
    difficulty: 8,
    label: "Гроссмейстер",
    stars: 5,
    skillLevel: 20,
    uciElo: 2600,
    moveTimeMs: 1650,
    description: "Максимум MVP-шкалы, гроссмейстерский ориентир.",
  },
};

export function getEngineDifficulty(difficulty: Difficulty | number) {
  return ENGINE_DIFFICULTY_LEVELS[normalizeDifficulty(difficulty)];
}

export function difficultyLabel(difficulty: Difficulty | number) {
  return getEngineDifficulty(difficulty).label;
}

export function starsForDifficulty(difficulty: Difficulty | number) {
  return getEngineDifficulty(difficulty).stars;
}

export function difficultyStars(difficulty: Difficulty | number) {
  return "★".repeat(starsForDifficulty(difficulty));
}

export function normalizeDifficulty(difficulty: Difficulty | number): Difficulty {
  return Math.max(0, Math.min(8, Math.floor(difficulty))) as Difficulty;
}
