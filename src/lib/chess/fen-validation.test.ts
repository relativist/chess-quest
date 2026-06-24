import { describe, expect, it } from "vitest";
import { STARTING_FEN, getFenSideToMove, validateBoardTemplateFen } from "./fen-validation";

function issueCodes(fen: string) {
  return validateBoardTemplateFen(fen).issues.map((issue) => issue.code);
}

describe("validateBoardTemplateFen", () => {
  it("accepts the standard starting position and reads side to move", () => {
    const result = validateBoardTemplateFen(STARTING_FEN);

    expect(result.ok).toBe(true);
    expect(result.sideToMove).toBe("white");
    expect(result.issues).toEqual([]);
  });

  it("reads black side to move from FEN", () => {
    expect(getFenSideToMove("4k3/8/8/8/8/8/8/4K3 b - - 0 1")).toBe("black");
  });

  it("requires exactly one white and one black king", () => {
    const codes = issueCodes("8/8/8/8/8/8/8/4K3 w - - 0 1");

    expect(codes).toContain("king.black");
  });

  it("limits pieces per color to the editor maximum", () => {
    const codes = issueCodes("QQQQQQQQ/QQQQQQQQ/QQQQQQQQ/8/8/8/8/4K2k w - - 0 1");

    expect(codes).toContain("pieces.white.limit");
  });

  it("rejects pawns on first or eighth rank", () => {
    const codes = issueCodes("4k3/8/8/8/8/8/8/4K2P w - - 0 1");

    expect(codes).toContain("pawn.edge-rank");
  });

  it("rejects adjacent kings", () => {
    const codes = issueCodes("8/8/8/8/8/8/4k3/4K3 w - - 0 1");

    expect(codes).toContain("king.adjacent");
  });

  it("rejects malformed board fields", () => {
    const codes = issueCodes("9/8/8/8/8/8/8/4K2k w - - 0 1");

    expect(codes).toContain("board.piece");
    expect(codes).toContain("board.rank-width");
    expect(codes).toContain("fen.chessjs");
  });
});
