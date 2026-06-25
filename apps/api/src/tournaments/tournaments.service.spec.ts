import { Prisma, TournamentFormat, TournamentStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TournamentsQueueService } from "../queues/tournaments-queue.service.js";
import { TournamentsService } from "./tournaments.service.js";

function makeTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: "tournament-1",
    name: "Spring Cup",
    format: TournamentFormat.single_elim,
    bracketSize: 16,
    registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
    startsAt: new Date("2026-07-15T18:00:00.000Z"),
    endedAt: null,
    status: TournamentStatus.upcoming,
    winnerId: null,
    createdAt: new Date("2026-06-23T12:00:00.000Z"),
    updatedAt: new Date("2026-06-23T12:00:00.000Z"),
    ...overrides,
  };
}

describe("TournamentsService", () => {
  let service: TournamentsService;
  let prisma: {
    tournament: {
      create: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
    tournamentRegistration: {
      count: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      deleteMany: ReturnType<typeof jest.fn>;
    };
    $queryRaw: ReturnType<typeof jest.fn>;
    $transaction: ReturnType<typeof jest.fn>;
  };
  let enqueueGenerateBracket: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    prisma = {
      tournament: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      tournamentRegistration: {
        count: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    enqueueGenerateBracket = jest.fn();
    enqueueGenerateBracket.mockResolvedValue(undefined);
    service = new TournamentsService(
      prisma as unknown as PrismaService,
      { enqueueGenerateBracket } as unknown as TournamentsQueueService,
    );
  });

  describe("createTournament", () => {
    it("creates a tournament in the upcoming state", async () => {
      prisma.tournament.create.mockResolvedValue(makeTournament());

      await service.createTournament({
        name: "Spring Cup",
        format: TournamentFormat.single_elim,
        bracketSize: 16,
        registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
        startsAt: new Date("2026-07-15T18:00:00.000Z"),
      });

      expect(prisma.tournament.create).toHaveBeenCalledWith({
        data: {
          name: "Spring Cup",
          format: TournamentFormat.single_elim,
          bracketSize: 16,
          registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
          startsAt: new Date("2026-07-15T18:00:00.000Z"),
          status: TournamentStatus.upcoming,
        },
      });
      expect(enqueueGenerateBracket).not.toHaveBeenCalled();
    });

    it("throws 400 INVALID_TOURNAMENT_SCHEDULE when startsAt is before registrationOpensAt", async () => {
      const invalidInput = {
        name: "Spring Cup",
        format: TournamentFormat.single_elim,
        bracketSize: 16,
        registrationOpensAt: new Date("2026-07-15T18:00:00.000Z"),
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
      };

      await expect(service.createTournament(invalidInput)).rejects.toMatchObject({
        response: { error: "INVALID_TOURNAMENT_SCHEDULE" },
      });
      await expect(service.createTournament(invalidInput)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.tournament.create).not.toHaveBeenCalled();
    });
  });

  describe("openRegistration", () => {
    it("transitions an upcoming tournament to registration_open", async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(makeTournament());
      prisma.tournament.updateMany.mockResolvedValue({ count: 1 });
      prisma.tournament.findUnique.mockResolvedValueOnce(
        makeTournament({ status: TournamentStatus.registration_open }),
      );

      const result = await service.openRegistration("tournament-1");

      expect(prisma.tournament.updateMany).toHaveBeenCalledWith({
        where: { id: "tournament-1", status: TournamentStatus.upcoming },
        data: { status: TournamentStatus.registration_open },
      });
      expect(result.status).toBe(TournamentStatus.registration_open);
    });

    it("throws 409 TOURNAMENT_ALREADY_OPEN when registration is already open", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );

      await expect(service.openRegistration("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_ALREADY_OPEN" },
      });
      await expect(service.openRegistration("tournament-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.tournament.updateMany).not.toHaveBeenCalled();
    });

    it("throws 404 TOURNAMENT_NOT_FOUND when the tournament does not exist", async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.openRegistration("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 409 TOURNAMENT_NOT_UPCOMING when the tournament is in progress", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.in_progress }),
      );

      await expect(service.openRegistration("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_NOT_UPCOMING" },
      });
      expect(prisma.tournament.updateMany).not.toHaveBeenCalled();
    });

    it("throws 409 TOURNAMENT_NOT_UPCOMING when the tournament is completed", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.completed }),
      );

      await expect(service.openRegistration("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_NOT_UPCOMING" },
      });
    });

    it("throws 409 TOURNAMENT_NOT_UPCOMING when a concurrent transition wins the update", async () => {
      prisma.tournament.findUnique
        .mockResolvedValueOnce(makeTournament())
        .mockResolvedValueOnce(makeTournament());
      prisma.tournament.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.openRegistration("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_NOT_UPCOMING" },
      });
    });
  });

  describe("startTournament", () => {
    it("starts a tournament with enough players and enqueues generate-bracket", async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(2);
      prisma.tournament.updateMany.mockResolvedValue({ count: 1 });
      prisma.tournament.findUnique.mockResolvedValueOnce(
        makeTournament({ status: TournamentStatus.in_progress }),
      );

      const result = await service.startTournament("tournament-1");

      expect(prisma.tournament.updateMany).toHaveBeenCalledWith({
        where: { id: "tournament-1", status: TournamentStatus.registration_open },
        data: { status: TournamentStatus.in_progress },
      });
      expect(enqueueGenerateBracket).toHaveBeenCalledWith("tournament-1");
      expect(result.status).toBe(TournamentStatus.in_progress);
    });

    it("throws 409 NOT_ENOUGH_PLAYERS when fewer than two players are registered", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(1);

      await expect(service.startTournament("tournament-1")).rejects.toMatchObject({
        response: { error: "NOT_ENOUGH_PLAYERS" },
      });
      await expect(service.startTournament("tournament-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(enqueueGenerateBracket).not.toHaveBeenCalled();
    });

    it("throws 409 TOURNAMENT_ALREADY_STARTED when the tournament is in progress", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.in_progress }),
      );

      await expect(service.startTournament("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_ALREADY_STARTED" },
      });
      expect(enqueueGenerateBracket).not.toHaveBeenCalled();
    });

    it("throws 409 TOURNAMENT_ALREADY_STARTED when the tournament is completed", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.completed }),
      );

      await expect(service.startTournament("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_ALREADY_STARTED" },
      });
    });

    it("throws 409 TOURNAMENT_NOT_REGISTRATION_OPEN when the tournament is still upcoming", async () => {
      prisma.tournament.findUnique.mockResolvedValue(makeTournament());

      await expect(service.startTournament("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_NOT_REGISTRATION_OPEN" },
      });
      expect(enqueueGenerateBracket).not.toHaveBeenCalled();
    });

    it("throws 409 TOURNAMENT_NOT_REGISTRATION_OPEN when a concurrent transition wins the update", async () => {
      prisma.tournament.findUnique
        .mockResolvedValueOnce(makeTournament({ status: TournamentStatus.registration_open }))
        .mockResolvedValueOnce(makeTournament({ status: TournamentStatus.registration_open }));
      prisma.tournamentRegistration.count.mockResolvedValue(2);
      prisma.tournament.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.startTournament("tournament-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_NOT_REGISTRATION_OPEN" },
      });
      expect(enqueueGenerateBracket).not.toHaveBeenCalled();
    });

    it("rolls back the tournament status when enqueueing generate-bracket fails", async () => {
      const queueError = new Error("Redis unavailable");
      prisma.tournament.findUnique.mockResolvedValueOnce(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(2);
      prisma.tournament.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.tournament.updateMany.mockResolvedValueOnce({ count: 1 });
      enqueueGenerateBracket.mockRejectedValue(queueError);

      await expect(service.startTournament("tournament-1")).rejects.toThrow(queueError);

      expect(prisma.tournament.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: "tournament-1", status: TournamentStatus.in_progress },
        data: { status: TournamentStatus.registration_open },
      });
    });

    it("throws 404 TOURNAMENT_NOT_FOUND when the tournament does not exist", async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.startTournament("missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(enqueueGenerateBracket).not.toHaveBeenCalled();
    });
  });

  describe("registerPlayer", () => {
    beforeEach(() => {
      prisma.$queryRaw.mockResolvedValue([{ id: "tournament-1" }]);
    });

    it("creates a registration when tournament is open and has capacity", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open, bracketSize: 16 }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(5);
      prisma.tournamentRegistration.create.mockResolvedValue({});

      await service.registerPlayer("tournament-1", "user-1");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.tournamentRegistration.create).toHaveBeenCalledWith({
        data: { tournamentId: "tournament-1", userId: "user-1" },
      });
    });

    it("locks the tournament row before counting registrations to prevent overbooking", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open, bracketSize: 8 }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(7);
      prisma.tournamentRegistration.create.mockResolvedValue({});

      await service.registerPlayer("tournament-1", "user-1");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.tournamentRegistration.count).toHaveBeenCalledWith({
        where: { tournamentId: "tournament-1" },
      });
      expect(prisma.tournamentRegistration.create).toHaveBeenCalledWith({
        data: { tournamentId: "tournament-1", userId: "user-1" },
      });
    });

    it("throws 409 ALREADY_REGISTERED when the player is already registered", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(0);
      prisma.tournamentRegistration.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "mock",
        }),
      );

      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toMatchObject({
        response: { error: "ALREADY_REGISTERED" },
      });
      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("throws 409 REGISTRATION_CLOSED when the tournament is not open", async () => {
      prisma.tournament.findUnique.mockResolvedValue(makeTournament());

      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toMatchObject({
        response: { error: "REGISTRATION_CLOSED" },
      });
      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.tournamentRegistration.create).not.toHaveBeenCalled();
    });

    it("throws 409 REGISTRATION_CLOSED when the tournament is in_progress", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.in_progress }),
      );

      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toMatchObject({
        response: { error: "REGISTRATION_CLOSED" },
      });
      expect(prisma.tournamentRegistration.create).not.toHaveBeenCalled();
    });

    it("throws 409 TOURNAMENT_FULL when bracket capacity is reached", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open, bracketSize: 8 }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(8);

      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_FULL" },
      });
      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.tournamentRegistration.create).not.toHaveBeenCalled();
    });

    it("throws 404 TOURNAMENT_NOT_FOUND when the tournament does not exist", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.registerPlayer("missing", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("re-throws non-unique-constraint errors from create", async () => {
      const dbError = new Error("connection lost");
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.count.mockResolvedValue(0);
      prisma.tournamentRegistration.create.mockRejectedValue(dbError);

      await expect(service.registerPlayer("tournament-1", "user-1")).rejects.toThrow(dbError);
    });
  });

  describe("unregisterPlayer", () => {
    it("deletes the registration when tournament is open", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.deleteMany.mockResolvedValue({ count: 1 });

      await service.unregisterPlayer("tournament-1", "user-1");

      expect(prisma.tournamentRegistration.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: "tournament-1", userId: "user-1" },
      });
    });

    it("succeeds silently when the player was not registered", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );
      prisma.tournamentRegistration.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unregisterPlayer("tournament-1", "user-2")).resolves.toBeUndefined();
    });

    it("throws 409 REGISTRATION_CLOSED when the tournament is not open", async () => {
      prisma.tournament.findUnique.mockResolvedValue(makeTournament());

      await expect(service.unregisterPlayer("tournament-1", "user-1")).rejects.toMatchObject({
        response: { error: "REGISTRATION_CLOSED" },
      });
      await expect(service.unregisterPlayer("tournament-1", "user-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.tournamentRegistration.deleteMany).not.toHaveBeenCalled();
    });

    it("throws 409 REGISTRATION_CLOSED when the tournament is completed", async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ status: TournamentStatus.completed }),
      );

      await expect(service.unregisterPlayer("tournament-1", "user-1")).rejects.toMatchObject({
        response: { error: "REGISTRATION_CLOSED" },
      });
      expect(prisma.tournamentRegistration.deleteMany).not.toHaveBeenCalled();
    });

    it("throws 404 TOURNAMENT_NOT_FOUND when the tournament does not exist", async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.unregisterPlayer("missing", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
