import { describe, expect, it } from "vitest";
import { STARTING_FEN } from "@/lib/chess/fen-validation";
import { fenToBoardSquares } from "@/lib/chess/fen-board";
import { getCurrentQuestMap, getGameCardById, getQuestMapPageData } from "./quest-data";

describe("quest-data", () => {
  it("returns the current demo map with progress totals", async () => {
    const map = await getCurrentQuestMap();

    expect(map.cards).toHaveLength(5);
    expect(map.maxScore).toBe(2500);
    expect(map.earnedScore).toBe(100);
    expect(map.earnedGold).toBe(100);
    expect(map.completedCards).toBe(1);
    expect(map.totalWins).toBe(1);
    expect(map.canOpenNextMap).toBe(false);
  });

  it("lists the built-in published maps for navigation", async () => {
    const data = await getQuestMapPageData();

    expect(data.maps.map((map) => map.slug)).toEqual([
      "demo-road-to-tower",
      "forest-tactics-trail",
      "desert-endgame-road",
      "citadel-checkmate-ascent",
    ]);
  });

  it("returns standard setup data for the first card", async () => {
    const card = await getGameCardById("opening-gate");

    expect(card).toMatchObject({ usesStandardSetup: true, startingFen: STARTING_FEN, sideToMove: "white" });
  });

  it("returns FEN template data for a positioned card", async () => {
    const card = await getGameCardById("queen-pressure");

    expect(card?.usesStandardSetup).toBe(false);
    expect(card?.startingFen).toContain("3q4");
  });

  it("renders 64 squares from a FEN", () => {
    const squares = fenToBoardSquares(STARTING_FEN);

    expect(squares).toHaveLength(64);
    expect(squares.some((square) => square.piece?.imageSrc.endsWith("/pieces/white-king.png"))).toBe(true);
    expect(squares.some((square) => square.piece?.imageSrc.endsWith("/pieces/black-king.png"))).toBe(true);
  });
});
