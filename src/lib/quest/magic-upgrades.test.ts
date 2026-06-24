import { describe, expect, it } from "vitest";
import { getMagicUpgradeById, MAGIC_UPGRADES } from "./magic-upgrades";

describe("magic upgrade specs", () => {
  it("defines the planned MVP upgrade set", () => {
    expect(MAGIC_UPGRADES.map((upgrade) => upgrade.id)).toEqual([
      "engine_hint",
      "promote_pawn_bishop",
      "promote_pawn_knight",
      "promote_pawn_rook",
      "promote_pawn_queen",
    ]);
  });

  it("defines positive costs for every upgrade", () => {
    for (const upgrade of MAGIC_UPGRADES) {
      expect(upgrade.costGold).toBeGreaterThan(0);
    }
  });

  it("keeps the player's turn after a hint", () => {
    const hint = getMagicUpgradeById("engine_hint");

    expect(hint?.consumesPlayerAction).toBe(false);
    expect(hint?.afterUse).toBe("player_keeps_turn");
  });

  it("limits piece-changing magic to own pawns", () => {
    const bishop = getMagicUpgradeById("promote_pawn_bishop");
    const knight = getMagicUpgradeById("promote_pawn_knight");
    const rook = getMagicUpgradeById("promote_pawn_rook");
    const queen = getMagicUpgradeById("promote_pawn_queen");

    expect(bishop?.target).toBe("own_pawn");
    expect(bishop?.replacementPiece).toBe("b");
    expect(knight?.replacementPiece).toBe("n");
    expect(rook?.replacementPiece).toBe("r");
    expect(queen?.replacementPiece).toBe("q");
    expect(rook?.kingRule).toContain("не может");

    for (const upgrade of [bishop, knight, rook, queen]) {
      expect(upgrade?.consumesPlayerAction).toBe(true);
      expect(upgrade?.afterUse).toBe("engine_reply");
    }
  });
});
