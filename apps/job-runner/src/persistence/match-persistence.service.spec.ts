import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MatchEndedPayload } from "../match-events/match-ended.types.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { MatchPersistenceService } from "./match-persistence.service.js";

const playerAId = "11111111-1111-4111-8111-111111111111";
const playerBId = "22222222-2222-4222-8222-222222222222";
const matchId = "33333333-3333-4333-8333-333333333333";

function createPayload(): MatchEndedPayload {
  return {
    matchId,
    players: [
      { userId: playerAId, displayName: "alice", rating: 1000 },
      { userId: playerBId, displayName: "bob", rating: 1000 },
    ],
    rounds: [
      {
        roundNumber: 1,
        moveA: "rock",
        moveB: "scissors",
        winner: "a",
        resolvedAt: "2026-06-09T10:00:01.000Z",
      },
      {
        roundNumber: 2,
        moveA: "paper",
        moveB: "rock",
        winner: "a",
        resolvedAt: "2026-06-09T10:00:02.000Z",
      },
    ],
    winner: playerAId,
    finalScore: { a: 2, b: 0 },
    startedAt: "2026-06-09T10:00:00.000Z",
  };
}

type MockTx = {
  match: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  round: {
    upsert: jest.Mock;
  };
  eloRating: {
    upsert: jest.Mock;
    update: jest.Mock;
  };
  eloHistory: {
    createMany: jest.Mock;
  };
};

function createTx(overrides: Partial<MockTx> = {}): MockTx {
  return {
    match: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async () => ({})),
    },
    round: {
      upsert: jest.fn(async () => ({})),
    },
    eloRating: {
      upsert: jest.fn(async () => ({ rating: 1000, gamesPlayed: 30 })),
      update: jest.fn(async () => ({})),
    },
    eloHistory: {
      createMany: jest.fn(async () => ({})),
    },
    ...overrides,
  };
}

describe("MatchPersistenceService", () => {
  let tx: ReturnType<typeof createTx>;
  let prisma: {
    $transaction: (callback: (client: MockTx) => Promise<unknown>) => Promise<unknown>;
  };
  let service: MatchPersistenceService;

  beforeEach(() => {
    tx = createTx();
    prisma = {
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    };
    service = new MatchPersistenceService(prisma as unknown as PrismaService);
  });

  it("persists a match-ended payload and updates both ELO ratings in one transaction", async () => {
    const persisted = await service.persistMatchEnded(createPayload());

    expect(persisted).toBe(true);
    expect(tx.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: matchId,
          playerAId,
          playerBId,
          winnerId: playerAId,
          scoreA: 2,
          scoreB: 0,
          status: "ended",
        }),
      }),
    );
    expect(tx.round.upsert).toHaveBeenCalledTimes(2);
    expect(tx.eloRating.update).toHaveBeenCalledWith({
      where: { userId: playerAId },
      data: { rating: 1016, gamesPlayed: { increment: 1 } },
    });
    expect(tx.eloRating.update).toHaveBeenCalledWith({
      where: { userId: playerBId },
      data: { rating: 984, gamesPlayed: { increment: 1 } },
    });
    expect(tx.eloHistory.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: playerAId, ratingBefore: 1000, ratingAfter: 1016 }),
        expect.objectContaining({ userId: playerBId, ratingBefore: 1000, ratingAfter: 984 }),
      ]),
    });
  });

  it("skips writes when the match already exists", async () => {
    tx.match.findUnique.mockImplementation(async () => ({ id: matchId }));

    const persisted = await service.persistMatchEnded(createPayload());

    expect(persisted).toBe(false);
    expect(tx.match.create).not.toHaveBeenCalled();
    expect(tx.round.upsert).not.toHaveBeenCalled();
    expect(tx.eloRating.update).not.toHaveBeenCalled();
    expect(tx.eloHistory.createMany).not.toHaveBeenCalled();
  });
});
