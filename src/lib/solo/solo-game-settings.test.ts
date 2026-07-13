import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOLO_GAME_SETTINGS,
  parseSoloGameSettings,
  serializeSoloGameSettings,
  soloGameHref,
} from "./solo-game-settings";

describe("solo game settings", () => {
  it("parses a complete valid configuration", () => {
    expect(parseSoloGameSettings({
      count: "4",
      difficulty: "7",
      gold: "3000",
      objective: "give_checks",
      side: "black",
    })).toEqual({
      difficulty: 7,
      gold: 3000,
      objective: { checks: 4, type: "give_checks" },
      side: "black",
    });
  });

  it("uses safe defaults for unsupported scalar values", () => {
    expect(parseSoloGameSettings({
      difficulty: "12",
      gold: "500",
      objective: "unknown",
      side: "green",
    })).toEqual(DEFAULT_SOLO_GAME_SETTINGS);
  });

  it.each([
    ["checkmate", undefined, { type: "checkmate" }],
    ["checkmate_in_moves", "2", { moves: 2, type: "checkmate_in_moves" }],
    ["give_check", undefined, { type: "give_check" }],
    ["give_checks", "5", { checks: 5, type: "give_checks" }],
    ["survive_half_moves", "12", { halfMoves: 12, type: "survive_half_moves" }],
    ["capture_pieces", "6", { pieces: 6, type: "capture_pieces" }],
  ])("parses objective %s", (objective, count, expected) => {
    expect(parseSoloGameSettings({ count, objective }).objective).toEqual(expected);
  });

  it("keeps objective counts inside the editor range", () => {
    expect(parseSoloGameSettings({ count: "0", objective: "give_checks" }).objective).toEqual({ checks: 1, type: "give_checks" });
    expect(parseSoloGameSettings({ count: "120", objective: "capture_pieces" }).objective).toEqual({ pieces: 99, type: "capture_pieces" });
  });

  it("serializes settings into a reproducible game URL", () => {
    const settings = parseSoloGameSettings({
      count: "8",
      difficulty: "3",
      gold: "1000",
      objective: "survive_half_moves",
      side: "white",
    });

    expect(serializeSoloGameSettings(settings).toString()).toBe("difficulty=3&gold=1000&objective=survive_half_moves&side=white&count=8");
    expect(soloGameHref(settings)).toBe("/solo/game?difficulty=3&gold=1000&objective=survive_half_moves&side=white&count=8");
  });
});
