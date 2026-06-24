import type { DemoQuestCardSeed } from "@/lib/demo-seed";

export type CardObjective =
  | { type: "checkmate" }
  | { type: "give_check" }
  | { piece: "bishop" | "knight" | "pawn" | "queen" | "rook"; type: "capture_piece" }
  | { pieces: number; type: "capture_pieces" }
  | { halfMoves: number; type: "survive_half_moves" };

export type ObjectiveResult = {
  completed: boolean;
  label: string;
};

export type ObjectiveEvaluationInput = {
  capturedPiece?: string;
  capturedPieces?: number;
  completedHalfMoves: number;
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
    case "give_check":
      return "Поставить шах. Мат также засчитывает победу.";
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
    case "give_check":
      return "Поставить шах";
    case "survive_half_moves":
      return "Продержаться " + objective.halfMoves + " полуходов";
  }
}

export function objectiveProgressLabel(objective: CardObjective, completedHalfMoves: number, capturedPieces = 0) {
  switch (objective.type) {
    case "capture_piece":
      return "Цель: съесть " + pieceLabel(objective.piece);
    case "capture_pieces": {
      const current = Math.min(capturedPieces, objective.pieces);
      return current + " / " + objective.pieces + " фигур";
    }
    case "checkmate":
      return "Цель: поставить мат";
    case "give_check":
      return "Цель: поставить шах";
    case "survive_half_moves": {
      const current = Math.min(completedHalfMoves, objective.halfMoves);
      return current + " / " + objective.halfMoves + " полуходов";
    }
  }
}

export function evaluateCardObjective(objective: CardObjective, input: ObjectiveEvaluationInput): ObjectiveResult {
  if (input.isCheckmate) {
    return { completed: true, label: "Мат. Цель карточки выполнена." };
  }

  switch (objective.type) {
    case "capture_piece":
      if (capturedPieceMatches(objective.piece, input.capturedPiece)) {
        return { completed: true, label: "Целевая фигура съедена: " + pieceLabel(objective.piece) + "." };
      }
      return { completed: false, label: objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0) };
    case "capture_pieces": {
      const capturedPieces = input.capturedPieces ?? 0;
      if (capturedPieces >= objective.pieces) {
        return { completed: true, label: "Съедено фигур противника: " + objective.pieces + "." };
      }
      return { completed: false, label: objectiveProgressLabel(objective, input.completedHalfMoves, capturedPieces) };
    }
    case "checkmate":
      return { completed: false, label: objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0) };
    case "give_check":
      if (input.isCheck) return { completed: true, label: "Шах поставлен. Цель карточки выполнена." };
      return { completed: false, label: objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0) };
    case "survive_half_moves":
      if (input.completedHalfMoves >= objective.halfMoves) {
        return { completed: true, label: "Вы продержались " + objective.halfMoves + " полуходов." };
      }
      return { completed: false, label: objectiveProgressLabel(objective, input.completedHalfMoves, input.capturedPieces ?? 0) };
  }
}

export function normalizeCardObjective(value: unknown, fallback: CardObjective = { type: "checkmate" }): CardObjective {
  if (!value || typeof value !== "object") return fallback;

  const objective = value as Partial<CardObjective> & { halfMoves?: unknown; pieces?: unknown };

  if (objective.type === "checkmate" || objective.type === "give_check") return { type: objective.type };
  if (objective.type === "survive_half_moves") return { halfMoves: toObjectiveCount(objective.halfMoves, 8), type: "survive_half_moves" };
  if (objective.type === "capture_pieces") return { pieces: toObjectiveCount(objective.pieces, 1), type: "capture_pieces" };
  if (objective.type === "capture_piece" && isCapturePiece(objective.piece)) return { piece: objective.piece, type: "capture_piece" };

  return fallback;
}

function toObjectiveCount(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(99, Math.max(1, Math.floor(parsed)));
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
