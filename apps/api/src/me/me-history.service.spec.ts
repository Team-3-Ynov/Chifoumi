import { MatchStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaService } from "../prisma/prisma.service.js";
import { encodeHistoryCursor } from "./history-cursor.js";
import { MeHistoryService } from "./me-history.service.js";

describe("MeHistoryService", () => {
  let service: MeHistoryService;
  let prisma: { match: { findMany: ReturnType<typeof jest.fn> } };

  beforeEach(() => {
    prisma = {
      match: {
        findMany: jest.fn(),
      },
    };
    service = new MeHistoryService(prisma as unknown as PrismaService);
  });

  it("returns first page with nextCursor when more rows exist", async () => {
    const lastPageEndedAt = new Date("2026-05-31T12:00:00.000Z");
    prisma.match.findMany.mockResolvedValue([
      makeMatch({ id: "match-1", endedAt: new Date("2026-06-01T12:00:00.000Z") }),
      makeMatch({ id: "match-2", endedAt: lastPageEndedAt }),
      makeMatch({ id: "match-3", endedAt: new Date("2026-05-30T12:00:00.000Z") }),
    ]);

    const result = await service.getHistory("user-a", 2);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.matchId).toBe("match-1");
    expect(result.nextCursor).toBe(encodeHistoryCursor(lastPageEndedAt, "match-2"));
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: [{ endedAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("applies cursor filter for the next page", async () => {
    const cursor = encodeHistoryCursor(new Date("2026-06-01T12:00:00.000Z"), "match-2");
    prisma.match.findMany.mockResolvedValue([]);

    await service.getHistory("user-a", 20, cursor);

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { endedAt: { lt: new Date("2026-06-01T12:00:00.000Z") } },
                {
                  endedAt: new Date("2026-06-01T12:00:00.000Z"),
                  id: { lt: "match-2" },
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it("maps opponent and elo delta from included relations", async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: "match-1",
        playerAId: "user-a",
        playerBId: "user-b",
        winnerId: "user-a",
        scoreA: 2,
        scoreB: 1,
        endedAt: new Date("2026-06-01T12:00:00.000Z"),
        playerA: { id: "user-a", displayName: "Alice" },
        playerB: { id: "user-b", displayName: "Bob" },
        eloHistory: [
          { userId: "user-a", ratingBefore: 1000, delta: 16 },
          { userId: "user-b", ratingBefore: 1040, delta: -16 },
        ],
      },
    ]);

    const result = await service.getHistory("user-a", 20);

    expect(result.items[0]).toEqual({
      matchId: "match-1",
      opponent: { displayName: "Bob", ratingAtMatch: 1040 },
      scoreA: 2,
      scoreB: 1,
      isWinner: true,
      eloDelta: 16,
      endedAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    expect(result.nextCursor).toBeNull();
  });
});

function makeMatch(overrides: { id: string; endedAt: Date }) {
  return {
    id: overrides.id,
    playerAId: "user-a",
    playerBId: "user-b",
    winnerId: "user-a",
    scoreA: 2,
    scoreB: 0,
    endedAt: overrides.endedAt,
    status: MatchStatus.ended,
    playerA: { id: "user-a", displayName: "Alice" },
    playerB: { id: "user-b", displayName: "Bob" },
    eloHistory: [
      { userId: "user-a", ratingBefore: 1000, delta: 12 },
      { userId: "user-b", ratingBefore: 1010, delta: -12 },
    ],
  };
}
