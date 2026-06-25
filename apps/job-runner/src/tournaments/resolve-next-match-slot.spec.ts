import { describe, expect, it } from "@jest/globals";
import { resolveNextMatchSlotUpdate } from "./resolve-next-match-slot.js";

describe("resolveNextMatchSlotUpdate", () => {
  it("fills slot A when both slots are empty", () => {
    expect(resolveNextMatchSlotUpdate({ slotAId: null, slotBId: null }, "player-a")).toEqual({
      slotAId: "player-a",
    });
  });

  it("fills slot B when slot A is already occupied", () => {
    expect(
      resolveNextMatchSlotUpdate({ slotAId: "player-bye", slotBId: null }, "player-a"),
    ).toEqual({
      slotBId: "player-a",
    });
  });

  it("returns null when the winner is already present", () => {
    expect(
      resolveNextMatchSlotUpdate({ slotAId: "player-a", slotBId: null }, "player-a"),
    ).toBeNull();
  });
});
