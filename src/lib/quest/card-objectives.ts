import type {DemoQuestCardSeed} from "@/lib/demo-seed";

export type CardObjective =
  | { type: "checkmate" }
  | { moves: number; type: "checkmate_in_moves" }
  | { type: "give_check" }
  | { checks: number; type: "give_checks" }
  | { piece: "bishop" | "knight" | "pawn" | "queen" | "rook"; type: "capture_piece" }
  | { pieces: number; type: "capture_pieces" }
  | { halfMoves: number; type: "survive_half_moves" };

export type ObjectiveResult = {
  completed: boolean;
  failed: boolean;
  label: string;
};

export type ObjectiveEvaluationInput = {
  capturedPiece?: string;
  capturedPieces?: number;
  completedHalfMoves: number;
  completedPlayerMoves?: number;
  givenChecks?: number;
  isCheck: boolean;
  isCheckmate: boolean;
};

const objectiveByCardSlug: Record<string, CardObjective> = {
  "opening-gate": { halfMoves: 8, type: "survive_half_moves" },
  "knight-fork": { type: "give_check" },
  "rook-file": { type: "checkmate" },
  "queen-pressure": { halfMoves: 10, type: "survive_half_moves" },
  "grandmaster-peak": { piece: "queen", type: "capture_piece" },
};

export function getCardObjective(card: Pick<DemoQuestCardSeed, "difficulty" | "objective" | "slug">): CardObjective {
  return card.objective ?? objectiveByCardSlug[card.slug] ?? fallbackObjective(card.difficulty);
}

export function describeCardObjective(objective: CardObjective) {
  switch (objective.type) {
    case "capture_piece":
      return "Съесть фигуру: " + pieceLabel(objective.piece) + ". Мат также засчитывает победу.";
    case "capture_pieces":
      return "Съесть фигур противника: " + objective.pieces + ". Мат также засчитывает победу.";
    case "checkmate":
      return "Поставить мат. Это основная цель карточки.";
    case "checkmate_in_moves":
      return "Поставить мат за " + moveCountLabel(objective.moves) + " или раньше.";
    case "give_check":
      return "Поставить шах. Мат также засчитывает победу.";
    case "give_checks":
      return "Поставить " + checkCountLabel(objective.checks) + " королю. Мат также засчитывает победу.";
    case "survive_half_moves":
      return "Продержаться " + objective.halfMoves + " полуходов. Мат также засчитывает победу.";
  }
}

export function objectiveShortLabel(objective: CardObjective) {
  switch (objective.type) {
    case "capture_piece":
      return "Съесть: " + pieceLabel(objective.piece);
    case "capture_pieces":
      return "Съесть фигур: " + objective.pieces;
    case "checkmate":
      return "Мат";
    case "checkmate_in_moves":
      return "Мат за " + moveCountLabel(objective.moves);
    case "give_check":
      return "Поставить шах";
    case "give_checks":
      return "Поставить шахов: " + objective.checks;
    case "survive_half_moves":
      return "Продержаться " + objective.halfMoves + " полуходов";
  }
}

export function objectiveProgressLabel(
  objective: CardObjective,
  completedHalfMoves: number,
  capturedPieces = 0,
  givenChecks = 0,
  completedPlayerMoves = Math.ceil(completedHalfMoves / 2),
) {
  switch (objective.type) {
    case "capture_piece":
      return "Цель: съесть " + pieceLabel(objective.piece);
    case "capture_pieces": {
      const current = Math.min(capturedPieces, objective.pieces);
      return current + " / " + objective.pieces + " фигур";
    }
    case "checkmate":
      return "Цель: поставить мат";
    case "checkmate_in_moves": {
      return completedPlayerMoves + " / " + objective.moves + " ходов использовано";
    }
    case "give_check":
      return "Цель: поставить шах";
    case "give_checks": {
      const current = Math.min(givenChecks, objective.checks);
      return current + " / " + objective.checks + " шахов";
    }
    case "survive_half_moves": {
      const current = Math.min(completedHalfMoves, objective.halfMoves);
      return current + " / " + objective.halfMoves + " полуходов";
    }
  }
}

export function evaluateCardObjective(objective: CardObjective, input: ObjectiveEvaluationInput): ObjectiveResult {
  if (input.isCheckmate && objective.type !== "checkmate_in_moves") {
    return completedObjective("Мат. Цель карточки выполнена.");
  }

  switch (objective.type) {
    case "capture_piece":
      if (capturedPieceMatches(objective.piece, input.capturedPiece)) {
        return completedObjective("Целевая фигура съедена: " + pieceLabel(objective.piece) + ".");
      }
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0));
    case "capture_pieces": {
      const capturedPieces = input.capturedPieces ?? 0;
      if (capturedPieces >= objective.pieces) {
        return completedObjective("Съедено фигур противника: " + objective.pieces + ".");
      }
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, capturedPieces));
    }
    case "checkmate":
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0));
    case "checkmate_in_moves": {
      const completedPlayerMoves = input.completedPlayerMoves ?? Math.ceil(input.completedHalfMoves / 2);
      if (input.isCheckmate && completedPlayerMoves <= objective.moves) {
        return completedObjective("Мат за " + moveCountLabel(completedPlayerMoves) + ". Цель карточки выполнена.");
      }
      if (completedPlayerMoves >= objective.moves) {
        const reason = completedPlayerMoves > objective.moves
          ? "Лимит " + moveCountLabel(objective.moves) + " превышен."
          : "Лимит " + moveCountLabel(objective.moves) + " исчерпан. Мат не поставлен.";
        return failedObjective(reason);
      }
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0, input.givenChecks ?? 0, completedPlayerMoves));
    }
    case "give_check":
      if (input.isCheck) return completedObjective("Шах поставлен. Цель карточки выполнена.");
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0));
    case "give_checks": {
      const givenChecks = input.givenChecks ?? 0;
      if (givenChecks >= objective.checks) {
        return completedObjective("Поставлено шахов королю: " + objective.checks + ".");
      }
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0, givenChecks));
    }
    case "survive_half_moves":
      if (input.completedHalfMoves >= objective.halfMoves) {
        return completedObjective("Вы продержались " + objective.halfMoves + " полуходов.");
      }
      return activeObjective(objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0));
  }
}

function activeObjective(label: string): ObjectiveResult {
  return { completed: false, failed: false, label };
}

function completedObjective(label: string): ObjectiveResult {
  return { completed: true, failed: false, label };
}

function failedObjective(label: string): ObjectiveResult {
  return { completed: false, failed: true, label };
}

export function normalizeCardObjective(value: unknown, fallback: CardObjective = { type: "checkmate" }): CardObjective {
  if (!value || typeof value !== "object") return fallback;

  const objective = value as Partial<CardObjective> & { checks?: unknown; halfMoves?: unknown; moves?: unknown; pieces?: unknown };

  if (objective.type === "checkmate" || objective.type === "give_check") return { type: objective.type };
  if (objective.type === "give_checks") return { checks: toObjectiveCount(objective.checks, 3), type: "give_checks" };
  if (objective.type === "checkmate_in_moves") return { moves: toObjectiveCount(objective.moves, 1, 99), type: "checkmate_in_moves" };
  if (objective.type === "survive_half_moves") return { halfMoves: toObjectiveCount(objective.halfMoves, 8), type: "survive_half_moves" };
  if (objective.type === "capture_pieces") return { pieces: toObjectiveCount(objective.pieces, 1), type: "capture_pieces" };
  if (objective.type === "capture_piece" && isCapturePiece(objective.piece)) return { piece: objective.piece, type: "capture_piece" };

  return fallback;
}

function toObjectiveCount(value: unknown, fallback: number, max = 99) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function isCapturePiece(piece: unknown): piece is Extract<CardObjective, { type: "capture_piece" }>["piece"] {
  return piece === "bishop" || piece === "knight" || piece === "pawn" || piece === "queen" || piece === "rook";
}

function capturedPieceMatches(piece: Extract<CardObjective, { type: "capture_piece" }>["piece"], capturedPiece: string | undefined) {
  const pieceCodes = {
    bishop: "b",
    knight: "n",
    pawn: "p",
    queen: "q",
    rook: "r",
  } as const;

  return capturedPiece === pieceCodes[piece];
}

function fallbackObjective(difficulty: DemoQuestCardSeed["difficulty"]): CardObjective {
  if (difficulty <= 2) return { type: "give_check" };
  if (difficulty <= 5) return { halfMoves: 8, type: "survive_half_moves" };
  return { type: "checkmate" };
}

function moveCountLabel(moves: number) {
  const lastTwoDigits = moves % 100;
  const lastDigit = moves % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return moves + " ходов";
  if (lastDigit === 1) return moves + " ход";
  if (lastDigit >= 2 && lastDigit <= 4) return moves + " хода";
  return moves + " ходов";
}

function checkCountLabel(checks: number) {
  if (checks === 1) return "1 шах";
  return checks + " шахов";
}

function pieceLabel(piece: CardObjective extends infer Objective ? Objective extends { piece: infer Piece } ? Piece : never : never) {
  const labels = {
    bishop: "слон",
    knight: "конь",
    pawn: "пешка",
    queen: "ферзь",
    rook: "ладья",
  } as const;

  return labels[piece];
}
