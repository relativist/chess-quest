import { describe, expect, it, vi } from "vitest";
import { moveCustomMapsAfterBuiltIns } from "./seed-demo-map";

describe("seed demo maps", () => {
  it("moves existing custom maps after built-in map orders", async () => {
    const update = vi.fn().mockResolvedValue({});
    const client = {
      questMap: {
        findMany: vi.fn().mockResolvedValue([{ id: "custom-a" }, { id: "custom-b" }]),
        update,
      },
    };

    await moveCustomMapsAfterBuiltIns(client as never);

    expect(client.questMap.findMany).toHaveBeenCalledWith({
      where: {
        slug: {
          notIn: [
            "demo-road-to-tower",
            "forest-tactics-trail",
            "desert-endgame-road",
            "citadel-checkmate-ascent",
          ],
        },
      },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    expect(update.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: "custom-a" }, data: { order: -100000 } },
      { where: { id: "custom-b" }, data: { order: -100001 } },
      { where: { id: "custom-a" }, data: { order: 5 } },
      { where: { id: "custom-b" }, data: { order: 6 } },
    ]);
  });
});
