import { describe, expect, it } from "vitest";
import { canOpenNextMapFromScores, getMapCompletionPercent, NEXT_MAP_UNLOCK_PERCENT } from "./map-unlock";

describe("map-unlock", () => {
  it("opens the next map at the configured score threshold", () => {
    expect(NEXT_MAP_UNLOCK_PERCENT).toBe(90);
    expect(canOpenNextMapFromScores(890, 1000)).toBe(false);
    expect(canOpenNextMapFromScores(900, 1000)).toBe(true);
    expect(canOpenNextMapFromScores(910, 1000)).toBe(true);
  });

  it("calculates bounded completion percent", () => {
    expect(getMapCompletionPercent(0, 0)).toBe(0);
    expect(getMapCompletionPercent(333, 1000)).toBe(33);
    expect(getMapCompletionPercent(1200, 1000)).toBe(100);
  });
});
