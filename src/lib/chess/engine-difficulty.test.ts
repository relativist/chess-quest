import { describe, expect, it } from "vitest";
import { ENGINE_DIFFICULTY_LEVELS, difficultyLabel, starsForDifficulty, getEngineDifficulty } from "./engine-difficulty";

describe("engine difficulty map", () => {
  it("defines every MVP difficulty from 0 to 8", () => {
    expect(Object.keys(ENGINE_DIFFICULTY_LEVELS).map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("maps stars to the agreed 1-5 scale", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(starsForDifficulty)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it("keeps engine strength monotonic and maxes out at grandmaster label", () => {
    const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(getEngineDifficulty);

    expect(difficultyLabel(8)).toBe("Гроссмейстер");
    expect(levels[0].skillLevel).toBe(0);
    expect(levels[8].skillLevel).toBe(20);

    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index].skillLevel).toBeGreaterThanOrEqual(levels[index - 1].skillLevel);
      expect(levels[index].uciElo).toBeGreaterThan(levels[index - 1].uciElo);
      expect(levels[index].moveTimeMs).toBeGreaterThan(levels[index - 1].moveTimeMs);
    }
  });
});
