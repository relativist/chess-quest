import {describe, expect, it} from "vitest";
import {
    type CardObjective,
    evaluateCardObjective,
    normalizeCardObjective,
    objectiveProgressLabel
} from "./card-objectives";

describe("card objective evaluator", () => {
  it("treats checkmate as a completed objective for every card type", () => {
    const objectives: CardObjective[] = [
      { type: "checkmate" },
      { type: "give_check" },
      { checks: 3, type: "give_checks" },
      { piece: "queen", type: "capture_piece" },
      { pieces: 2, type: "capture_pieces" },
      { halfMoves: 8, type: "survive_half_moves" },
    ];

    for (const objective of objectives) {
      expect(evaluateCardObjective(objective, {
        completedHalfMoves: 1,
        isCheck: true,
        isCheckmate: true,
      })).toMatchObject({ completed: true, label: "Мат. Цель карточки выполнена." });
    }
  });

  it("completes give_check when the player gives check", () => {
    expect(evaluateCardObjective({ type: "give_check" }, {
      completedHalfMoves: 1,
      isCheck: true,
      isCheckmate: false,
    })).toMatchObject({ completed: true, label: "Шах поставлен. Цель карточки выполнена." });
  });

  it("does not complete give_check without check", () => {
    expect(evaluateCardObjective({ type: "give_check" }, {
      completedHalfMoves: 1,
      isCheck: false,
      isCheckmate: false,
    })).toMatchObject({ completed: false, label: "Цель: поставить шах" });
  });

  it("completes counted checks after the configured check count", () => {
    expect(objectiveProgressLabel({ checks: 3, type: "give_checks" }, 2, 0, 2)).toBe("2 / 3 шахов");
    expect(evaluateCardObjective({ checks: 3, type: "give_checks" }, {
      completedHalfMoves: 5,
      givenChecks: 3,
      isCheck: true,
      isCheckmate: false,
    })).toMatchObject({ completed: true, label: "Поставлено шахов королю: 3." });
  });

  it("completes capture_piece only for the configured piece", () => {
    expect(evaluateCardObjective({ piece: "queen", type: "capture_piece" }, {
      capturedPiece: "q",
      completedHalfMoves: 3,
      isCheck: false,
      isCheckmate: false,
    })).toMatchObject({ completed: true, label: "Целевая фигура съедена: ферзь." });

    expect(evaluateCardObjective({ piece: "queen", type: "capture_piece" }, {
      capturedPiece: "r",
      completedHalfMoves: 3,
      isCheck: false,
      isCheckmate: false,
    })).toMatchObject({ completed: false, label: "Цель: съесть ферзь" });
  });

  it("completes counted captures after the configured piece count", () => {
    expect(objectiveProgressLabel({ pieces: 3, type: "capture_pieces" }, 2, 2)).toBe("2 / 3 фигур");
    expect(evaluateCardObjective({ pieces: 2, type: "capture_pieces" }, {
      capturedPieces: 2,
      completedHalfMoves: 4,
      isCheck: false,
      isCheckmate: false,
    })).toMatchObject({ completed: true, label: "Съедено фигур противника: 2." });
  });

  it("normalizes editor objective values", () => {
    expect(normalizeCardObjective({ halfMoves: 0, type: "survive_half_moves" })).toEqual({ halfMoves: 1, type: "survive_half_moves" });
    expect(normalizeCardObjective({ moves: 9, type: "checkmate_in_moves" })).toEqual({ moves: 9, type: "checkmate_in_moves" });
    expect(normalizeCardObjective({ checks: 4.9, type: "give_checks" })).toEqual({ checks: 4, type: "give_checks" });
    expect(normalizeCardObjective({ moves: 100, type: "checkmate_in_moves" })).toEqual({ moves: 99, type: "checkmate_in_moves" });
    expect(normalizeCardObjective({ pieces: 4.9, type: "capture_pieces" })).toEqual({ pieces: 4, type: "capture_pieces" });
    expect(normalizeCardObjective({ type: "unknown" })).toEqual({ type: "checkmate" });
  });


  it("completes mate-in objective on the configured player move or earlier", () => {
    expect(objectiveProgressLabel({ moves: 3, type: "checkmate_in_moves" }, 3)).toBe("2 / 3 ходов до мата");
    expect(evaluateCardObjective({ moves: 3, type: "checkmate_in_moves" }, {
      completedHalfMoves: 3,
      completedPlayerMoves: 2,
      isCheck: true,
      isCheckmate: true,
    })).toMatchObject({ completed: true, label: "Мат за 2 хода. Цель карточки выполнена." });
  });

  it("does not complete mate-in objective after the configured player move limit", () => {
    expect(evaluateCardObjective({ moves: 2, type: "checkmate_in_moves" }, {
      completedHalfMoves: 5,
      completedPlayerMoves: 3,
      isCheck: true,
      isCheckmate: true,
    })).toMatchObject({ completed: false, label: "Мат поставлен позже лимита 2 хода." });
  });

  it("completes survival after the configured half-move count", () => {
    expect(objectiveProgressLabel({ halfMoves: 8, type: "survive_half_moves" }, 3)).toBe("3 / 8 полуходов");
    expect(evaluateCardObjective({ halfMoves: 8, type: "survive_half_moves" }, {
      completedHalfMoves: 8,
      isCheck: false,
      isCheckmate: false,
    })).toMatchObject({ completed: true, label: "Вы продержались 8 полуходов." });
  });
});
