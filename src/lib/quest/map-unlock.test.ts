import {describe, expect, it} from "vitest";
import {canOpenNextMapFromCards, getMapCompletionPercent} from "./map-unlock";

describe("map-unlock", () => {
  it("opens the next map only when all cards are completed", () => {
    expect(canOpenNextMapFromCards(4, 5)).toBe(false);
    expect(canOpenNextMapFromCards(5, 5)).toBe(true);
    expect(canOpenNextMapFromCards(6, 5)).toBe(true);
    expect(canOpenNextMapFromCards(0, 0)).toBe(false);
  });

  it("calculates bounded card completion percent", () => {
    expect(getMapCompletionPercent(0, 0)).toBe(0);
    expect(getMapCompletionPercent(1, 3)).toBe(33);
    expect(getMapCompletionPercent(5, 5)).toBe(100);
    expect(getMapCompletionPercent(6, 5)).toBe(100);
  });
});
