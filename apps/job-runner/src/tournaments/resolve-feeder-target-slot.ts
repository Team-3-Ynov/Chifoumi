export type FeederMatchRef = {
  positionIndex: number;
};

export type ParentMatchSlots = {
  slotAId: string | null;
  slotBId: string | null;
};

/**
 * Maps a feeder winner to the parent slot derived from bracket positionIndex
 * (even → slot A, odd → slot B). When the preferred slot is already occupied
 * (e.g. bye pre-fill), falls back to the other empty slot.
 */
export function resolveFeederTargetSlotUpdate(
  feeder: FeederMatchRef,
  parent: ParentMatchSlots,
  winnerId: string,
): { slotAId?: string; slotBId?: string } | null {
  if (parent.slotAId === winnerId || parent.slotBId === winnerId) {
    return null;
  }

  const preferredSlot = feeder.positionIndex % 2 === 0 ? "a" : "b";

  if (preferredSlot === "a") {
    if (!parent.slotAId) {
      return { slotAId: winnerId };
    }

    if (!parent.slotBId) {
      return { slotBId: winnerId };
    }

    return null;
  }

  if (!parent.slotBId) {
    return { slotBId: winnerId };
  }

  if (!parent.slotAId) {
    return { slotAId: winnerId };
  }

  return null;
}
