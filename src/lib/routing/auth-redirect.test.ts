import { describe, expect, it } from "vitest";
import { getAuthenticatedHomePath, getLoginPath, getPostAuthenticationPath } from "./auth-redirect";

describe("auth redirects", () => {
  it("sends map editors to the map editor", () => {
    expect(getAuthenticatedHomePath({ role: "MAP_EDITOR" })).toBe("/map/editor");
  });

  it("sends regular players to the quest map", () => {
    expect(getAuthenticatedHomePath({ role: "PLAYER" })).toBe("/map");
  });

  it("shows the game-mode chooser after a player signs in", () => {
    expect(getPostAuthenticationPath({ role: "PLAYER" })).toBe("/start");
  });

  it("keeps map editors in the editor after sign in", () => {
    expect(getPostAuthenticationPath({ role: "MAP_EDITOR" })).toBe("/map/editor");
  });

  it("keeps login errors encoded in the auth URL", () => {
    expect(getLoginPath("Нужно войти")).toBe("/auth?mode=login&error=%D0%9D%D1%83%D0%B6%D0%BD%D0%BE%20%D0%B2%D0%BE%D0%B9%D1%82%D0%B8");
  });
});
