import { describe, expect, it } from "@jest/globals";
import { resolveFeederTargetSlotUpdate } from "./resolve-feeder-target-slot.js";

describe("resolveFeederTargetSlotUpdate", () => {
  it("fills slot A for an even-position feeder", () => {
    expect(
      resolveFeederTargetSlotUpdate(
        { positionIndex: 0 },
        { slotAId: null, slotBId: null },
        "player-a",
      ),
    ).toEqual({
      slotAId: "player-a",
    });
  });

  it("fills slot B for an odd-position feeder", () => {
    expect(
      resolveFeederTargetSlotUpdate(
        { positionIndex: 1 },
        { slotAId: null, slotBId: null },
        "player-b",
      ),
    ).toEqual({
      slotBId: "player-b",
    });
  });

  it("falls back to slot B when slot A is already occupied by a bye", () => {
    expect(
      resolveFeederTargetSlotUpdate(
        { positionIndex: 0 },
        { slotAId: "player-bye", slotBId: null },
        "player-a",
      ),
    ).toEqual({
      slotBId: "player-a",
    });
  });

  it("returns null when the winner is already present", () => {
    expect(
      resolveFeederTargetSlotUpdate(
        { positionIndex: 0 },
        { slotAId: "player-a", slotBId: null },
        "player-a",
      ),
    ).toBeNull();
  });

  it("returns null when both parent slots are occupied", () => {
    expect(
      resolveFeederTargetSlotUpdate(
        { positionIndex: 1 },
        { slotAId: "player-a", slotBId: "player-b" },
        "player-c",
      ),
    ).toBeNull();
  });
});
