import { describe, expect, it } from "vitest";
import { demoMapSeed, demoMapSeeds, getCardStartingFen, validateDemoSeedData } from "./demo-seed";
import { STARTING_FEN, validateBoardTemplateFen } from "./chess/fen-validation";

describe("demoMapSeed", () => {
  it("keeps the first published map with five ordered cards", () => {
    expect(demoMapSeed.slug).toBe("demo-road-to-tower");
    expect(demoMapSeed.isPublished).toBe(true);
    expect(demoMapSeed.cards).toHaveLength(5);
    expect(demoMapSeed.cards.map((card) => card.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("defines four built-in published maps before custom maps", () => {
    expect(demoMapSeeds).toHaveLength(4);
    expect(demoMapSeeds.map((map) => map.order)).toEqual([1, 2, 3, 4]);
    expect(demoMapSeeds.every((map) => map.isPublished)).toBe(true);
    expect(demoMapSeeds.every((map) => map.cards.length === 5)).toBe(true);
  });

  it("contains configured difficulty and reward values for the first map", () => {
    expect(demoMapSeed.cards.map((card) => card.difficulty)).toEqual([0, 2, 4, 6, 8]);
    expect(demoMapSeed.cards.map((card) => card.rewardGold)).toEqual([100, 300, 500, 700, 900]);
    expect(demoMapSeed.cards.map((card) => card.rewardScore)).toEqual([100, 300, 500, 700, 900]);
  });

  it("uses the standard FEN for cards without a template", () => {
    expect(getCardStartingFen(demoMapSeed.cards[0])).toBe(STARTING_FEN);
  });

  it("does not mention obsolete color selection in card copy", () => {
    expect(demoMapSeeds.flatMap((map) => map.cards).map((card) => card.text).join(" ")).not.toMatch(/выбери цвет/i);
  });

  it("has valid FEN for every stored board template", () => {
    for (const template of demoMapSeeds.flatMap((map) => map.boardTemplates)) {
      expect(validateBoardTemplateFen(template.fen), template.slug).toMatchObject({ ok: true });
    }
  });

  it("passes aggregate seed validation", () => {
    expect(validateDemoSeedData()).toEqual({ ok: true, issues: [] });
  });
});
