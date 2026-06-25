import { TournamentStatus, WinnerSlot } from "@chifoumi/db";
import { describe, expect, it, jest } from "@jest/globals";
import { UnrecoverableError } from "bullmq";
import { GenerateBracketService } from "./generate-bracket.service.js";

const tournamentId = "44444444-4444-4444-8444-444444444444";
const userAId = "11111111-1111-4111-8111-111111111111";
const userBId = "22222222-2222-4222-8222-222222222222";
const userCId = "33333333-3333-4333-8333-333333333333";

function createService(overrides: {
  prisma?: Record<string, unknown>;
  generateBracketLock?: Record<string, unknown>;
  notificationsQueue?: Record<string, unknown>;
}) {
  return new GenerateBracketService(
    overrides.prisma as never,
    overrides.generateBracketLock as never,
    overrides.notificationsQueue as never,
  );
}

describe("GenerateBracketService", () => {
  it("seeds registrations, creates linked matches and notifies players", async () => {
    const tournament = {
      id: tournamentId,
      name: "Spring Cup",
      bracketSize: 4,
      status: TournamentStatus.in_progress,
      registrations: [
        {
          userId: userAId,
          user: { id: userAId, displayName: "alice", email: "alice@test.com" },
        },
        {
          userId: userBId,
          user: { id: userBId, displayName: "bob", email: "bob@test.com" },
        },
        {
          userId: userCId,
          user: { id: userCId, displayName: "carol", email: "carol@test.com" },
        },
      ],
    };

    const createMany = jest.fn(async () => ({ count: 3 }));
    const registrationUpdate = jest.fn(async () => ({}));
    const prisma = {
      tournament: {
        findUnique: jest.fn(async () => tournament),
      },
      tournamentMatch: {
        count: jest.fn(async () => 0),
      },
      eloRating: {
        findMany: jest.fn(async () => [
          { userId: userAId, rating: 1600 },
          { userId: userBId, rating: 1500 },
          { userId: userCId, rating: 1400 },
        ]),
      },
      $transaction: jest.fn(async (callback: (tx: never) => Promise<void>) =>
        callback({
          tournamentRegistration: { update: registrationUpdate },
          tournamentMatch: { createMany },
        } as never),
      ),
    };
    const generateBracketLock = {
      acquire: jest.fn(async () => "token"),
      release: jest.fn(async () => undefined),
    };
    const notificationsQueue = {
      enqueueTournamentStartedMail: jest.fn(async () => undefined),
    };

    const service = createService({ prisma, generateBracketLock, notificationsQueue });
    const result = await service.processGenerateBracket({ tournamentId });

    expect(result).toBe("generated");
    expect(registrationUpdate).toHaveBeenCalledTimes(3);
    expect(createMany).toHaveBeenCalledTimes(1);

    const payload = (
      createMany.mock.calls[0] as unknown as [
        {
          data: Array<{
            round: number;
            slotAId: string | null;
            slotBId: string | null;
            winnerSlot: WinnerSlot | null;
            nextMatchId: string | null;
          }>;
        },
      ]
    )[0];
    expect(payload.data).toHaveLength(3);
    expect(payload.data.filter((match) => match.round === 1)).toHaveLength(2);
    expect(payload.data.some((match) => match.winnerSlot === WinnerSlot.a)).toBe(true);
    expect(payload.data.every((match) => match.round === 2 || match.nextMatchId !== null)).toBe(
      true,
    );
    expect(notificationsQueue.enqueueTournamentStartedMail).toHaveBeenCalledTimes(3);
    expect(generateBracketLock.release).toHaveBeenCalledWith(tournamentId, "token");
  });

  it("returns already_generated when tournament matches already exist", async () => {
    const prisma = {
      tournament: {
        findUnique: jest.fn(async () => ({
          id: tournamentId,
          status: TournamentStatus.in_progress,
          registrations: [],
        })),
      },
      tournamentMatch: {
        count: jest.fn(async () => 2),
      },
    };
    const generateBracketLock = {
      acquire: jest.fn(),
      release: jest.fn(),
    };

    const service = createService({
      prisma,
      generateBracketLock,
      notificationsQueue: { enqueueTournamentStartedMail: jest.fn() },
    });

    await expect(service.processGenerateBracket({ tournamentId })).resolves.toBe(
      "already_generated",
    );
    expect(generateBracketLock.acquire).not.toHaveBeenCalled();
  });

  it("re-enqueues tournament notifications when matches already exist", async () => {
    const tournament = {
      id: tournamentId,
      name: "Spring Cup",
      bracketSize: 4,
      status: TournamentStatus.in_progress,
      registrations: [
        {
          userId: userAId,
          user: { id: userAId, displayName: "alice", email: "alice@test.com" },
        },
        {
          userId: userBId,
          user: { id: userBId, displayName: "bob", email: "bob@test.com" },
        },
      ],
    };
    const notificationsQueue = {
      enqueueTournamentStartedMail: jest.fn(async () => undefined),
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn(async () => tournament),
      },
      tournamentMatch: {
        count: jest.fn(async () => 2),
      },
    };

    const service = createService({
      prisma,
      generateBracketLock: { acquire: jest.fn(), release: jest.fn() },
      notificationsQueue,
    });

    await expect(service.processGenerateBracket({ tournamentId })).resolves.toBe(
      "already_generated",
    );

    expect(notificationsQueue.enqueueTournamentStartedMail).toHaveBeenCalledTimes(2);
    expect(notificationsQueue.enqueueTournamentStartedMail).toHaveBeenCalledWith({
      tournamentId,
      userId: userAId,
      to: "alice@test.com",
      displayName: "alice",
      tournamentName: "Spring Cup",
    });
  });

  it("is idempotent after acquiring the lock", async () => {
    const tournament = {
      id: tournamentId,
      name: "Spring Cup",
      bracketSize: 4,
      status: TournamentStatus.in_progress,
      registrations: [
        {
          userId: userAId,
          user: { id: userAId, displayName: "alice", email: "alice@test.com" },
        },
        {
          userId: userBId,
          user: { id: userBId, displayName: "bob", email: "bob@test.com" },
        },
      ],
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn(async () => tournament),
      },
      tournamentMatch: {
        count: jest
          .fn()
          .mockResolvedValueOnce(0 as never)
          .mockResolvedValueOnce(3 as never),
      },
      eloRating: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const generateBracketLock = {
      acquire: jest.fn(async () => "token"),
      release: jest.fn(async () => undefined),
    };

    const service = createService({
      prisma,
      generateBracketLock,
      notificationsQueue: { enqueueTournamentStartedMail: jest.fn() },
    });

    await expect(service.processGenerateBracket({ tournamentId })).resolves.toBe(
      "already_generated",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(generateBracketLock.release).toHaveBeenCalledWith(tournamentId, "token");
  });

  it("throws when the distributed lock cannot be acquired", async () => {
    const tournament = {
      id: tournamentId,
      status: TournamentStatus.in_progress,
      registrations: [],
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn(async () => tournament),
      },
      tournamentMatch: {
        count: jest.fn(async () => 0),
      },
    };
    const generateBracketLock = {
      acquire: jest.fn(async () => null),
      release: jest.fn(),
    };

    const service = createService({
      prisma,
      generateBracketLock,
      notificationsQueue: { enqueueTournamentStartedMail: jest.fn() },
    });

    await expect(service.processGenerateBracket({ tournamentId })).rejects.toThrow(
      "Generate-bracket lock not acquired",
    );
  });

  it("rejects unsupported tournament statuses without retry", async () => {
    const prisma = {
      tournament: {
        findUnique: jest.fn(async () => ({
          id: tournamentId,
          status: TournamentStatus.registration_open,
          registrations: [],
        })),
      },
      tournamentMatch: {
        count: jest.fn(async () => 0),
      },
    };

    const service = createService({
      prisma,
      generateBracketLock: { acquire: jest.fn(), release: jest.fn() },
      notificationsQueue: { enqueueTournamentStartedMail: jest.fn() },
    });

    await expect(service.processGenerateBracket({ tournamentId })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
