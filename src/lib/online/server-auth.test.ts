import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  isDatabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: mocks.getPrisma,
  isDatabaseConfigured: mocks.isDatabaseConfigured,
}));

import {
  requireOnlineDatabase,
  requireOnlinePlayer,
} from "@/lib/online/server-auth";
import { OnlineServiceError } from "@/lib/online/errors";

describe("online server auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires PostgreSQL before exposing online operations", () => {
    mocks.isDatabaseConfigured.mockReturnValue(false);

    expect(() => requireOnlineDatabase()).toThrowError(
      expect.objectContaining<Partial<OnlineServiceError>>({
        code: "DATABASE_REQUIRED",
      }),
    );
    expect(mocks.getPrisma).not.toHaveBeenCalled();
  });

  it("requires an authenticated player", async () => {
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.getPrisma.mockReturnValue({});
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(requireOnlinePlayer()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("rejects editor roles and returns a minimal player DTO", async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce({
        displayName: "Editor",
        id: "editor",
        onlineRating: 0,
        role: "MAP_EDITOR",
      })
      .mockResolvedValueOnce({
        displayName: "Alice",
        id: "alice",
        onlineRating: 4,
        role: "PLAYER",
        passwordHash: "must-not-leak",
      });
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.getPrisma.mockReturnValue({ user: { findUnique } });
    mocks.getCurrentUser
      .mockResolvedValueOnce({ id: "editor" })
      .mockResolvedValueOnce({ id: "alice" });

    await expect(requireOnlinePlayer()).rejects.toMatchObject({
      code: "PLAYER_ROLE_REQUIRED",
    });
    await expect(requireOnlinePlayer()).resolves.toEqual({
      displayName: "Alice",
      id: "alice",
      onlineRating: 4,
    });
  });
});
