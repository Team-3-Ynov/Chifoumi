export function resolveNextMatchSlotUpdate(
  parent: { slotAId: string | null; slotBId: string | null },
  winnerId: string,
): { slotAId?: string; slotBId?: string } | null {
  if (parent.slotAId === winnerId || parent.slotBId === winnerId) {
    return null;
  }

  if (!parent.slotAId) {
    return { slotAId: winnerId };
  }

  if (!parent.slotBId) {
    return { slotBId: winnerId };
  }

  return null;
}
