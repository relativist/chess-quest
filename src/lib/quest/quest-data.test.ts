import {describe, expect, it} from "vitest";
import {STARTING_FEN} from "@/lib/chess/fen-validation";
import {fenToBoardSquares} from "@/lib/chess/fen-board";
import {demoMapSeed} from "@/lib/demo-seed";
import {getCurrentQuestMap, getGameCardById, getQuestMapPageData} from "./quest-data";

describe("quest-data", () => {
  it("returns the current demo map with progress totals", async () => {
    const map = await getCurrentQuestMap();

    expect(map.cards).toHaveLength(5);
    expect(map.maxScore).toBe(2300);
    expect(map.earnedScore).toBe(0);
    expect(map.earnedGold).toBe(0);
    expect(map.playerGold).toBe(0);
    expect(map.completedCards).toBe(0);
    expect(map.totalWins).toBe(0);
    expect(map.canOpenNextMap).toBe(false);
  });

  it("lists the built-in published maps for navigation", async () => {
    const data = await getQuestMapPageData();

    expect(data.maps.map((map) => map.slug)).toEqual([
      "demo-road-to-tower",
      "forest-tactics-trail",
      "desert-endgame-road",
      "citadel-checkmate-ascent",
      "holmy-darloga",
    ]);
  });

  it("returns the exported FEN for the first card", async () => {
    const card = await getGameCardById("opening-gate");

    expect(card).toMatchObject({
      usesStandardSetup: false,
      startingFen: demoMapSeed.cards[0].startingFen,
      sideToMove: "white",
    });
  });

  it("returns exported FEN data for a positioned card", async () => {
    const card = await getGameCardById("queen-pressure");
    const seedCard = demoMapSeed.cards.find((candidate) => candidate.slug === "queen-pressure");

    expect(card?.usesStandardSetup).toBe(false);
    expect(card?.startingFen).toBe(seedCard?.startingFen);
  });

  it("renders 64 squares from a FEN", () => {
    const squares = fenToBoardSquares(STARTING_FEN);

    expect(squares).toHaveLength(64);
    expect(squares.some((square) => square.piece?.code === "K")).toBe(true);
    expect(squares.some((square) => square.piece?.code === "k")).toBe(true);
  });
});
