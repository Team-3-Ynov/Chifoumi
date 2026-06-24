import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { TournamentFormat, TournamentStatus } from "@prisma/client";
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
      count: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      findMany: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
    tournamentRegistration: {
      count: ReturnType<typeof jest.fn>;
    };
  };
  let enqueueGenerateBracket: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    prisma = {
      tournament: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      tournamentRegistration: {
        count: jest.fn(),
      },
    };
    enqueueGenerateBracket = jest.fn();
    enqueueGenerateBracket.mockResolvedValue(undefined);
    service = new TournamentsService(
      prisma as unknown as PrismaService,
      { enqueueGenerateBracket } as unknown as TournamentsQueueService,
    );
  });

  describe("listTournaments", () => {
    it("returns a paginated tournament list filtered by status and sorted by start date", async () => {
      prisma.tournament.findMany.mockResolvedValue([
        makeTournament({
          id: "tournament-2",
          status: TournamentStatus.registration_open,
          startsAt: new Date("2026-07-10T18:00:00.000Z"),
          _count: { registrations: 3 },
        }),
      ]);
      prisma.tournament.count.mockResolvedValue(1);

      const result = await service.listTournaments({
        status: TournamentStatus.registration_open,
        page: 2,
        limit: 10,
      });

      expect(prisma.tournament.findMany).toHaveBeenCalledWith({
        where: { status: TournamentStatus.registration_open },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip: 10,
        take: 10,
        include: { _count: { select: { registrations: true } } },
      });
      expect(prisma.tournament.count).toHaveBeenCalledWith({
        where: { status: TournamentStatus.registration_open },
      });
      expect(result).toEqual({
        items: [
          {
            id: "tournament-2",
            name: "Spring Cup",
            format: TournamentFormat.single_elim,
            bracketSize: 16,
            status: TournamentStatus.registration_open,
            registrationsCount: 3,
            startsAt: new Date("2026-07-10T18:00:00.000Z"),
          },
        ],
        page: 2,
        limit: 10,
        total: 1,
      });
    });
  });

  describe("getTournamentDetail", () => {
    it("returns details with registrations and bracket grouped by round", async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        ...makeTournament({
          id: "tournament-1",
          status: TournamentStatus.in_progress,
          _count: { registrations: 2 },
        }),
        registrations: [
          {
            userId: "player-b",
            seed: 2,
            user: { displayName: "Grace" },
          },
          {
            userId: "player-a",
            seed: 1,
            user: { displayName: "Ada" },
          },
        ],
        matches: [
          {
            id: "tm-2",
            round: 2,
            matchId: null,
            slotA: { id: "player-a", displayName: "Ada" },
            slotB: null,
            match: null,
            winnerSlot: null,
          },
          {
            id: "tm-1",
            round: 1,
            matchId: "match-1",
            slotA: { id: "player-a", displayName: "Ada" },
            slotB: { id: "player-b", displayName: "Grace" },
            match: { scoreA: 2, scoreB: 1 },
            winnerSlot: "a",
          },
        ],
      });

      const result = await service.getTournamentDetail("tournament-1");

      expect(prisma.tournament.findUnique).toHaveBeenCalledWith({
        where: { id: "tournament-1" },
        include: {
          _count: { select: { registrations: true } },
          registrations: {
            include: {
              user: { select: { displayName: true } },
            },
          },
          matches: {
            include: {
              slotA: { select: { id: true, displayName: true } },
              slotB: { select: { id: true, displayName: true } },
              match: { select: { scoreA: true, scoreB: true } },
            },
            orderBy: [{ round: "asc" }, { id: "asc" }],
          },
        },
      });
      expect(result).toMatchObject({
        id: "tournament-1",
        status: TournamentStatus.in_progress,
        registrationsCount: 2,
        registrations: [
          { userId: "player-a", displayName: "Ada", seed: 1 },
          { userId: "player-b", displayName: "Grace", seed: 2 },
        ],
        bracket: [
          {
            round: 1,
            matches: [
              {
                id: "tm-1",
                matchId: "match-1",
                slotA: { userId: "player-a", displayName: "Ada" },
                slotB: { userId: "player-b", displayName: "Grace" },
                scoreA: 2,
                scoreB: 1,
                winnerSlot: "a",
              },
            ],
          },
          {
            round: 2,
            matches: [
              {
                id: "tm-2",
                matchId: null,
                slotA: { userId: "player-a", displayName: "Ada" },
                slotB: null,
                scoreA: null,
                scoreB: null,
                winnerSlot: null,
              },
            ],
          },
        ],
      });
    });

    it("throws 404 TOURNAMENT_NOT_FOUND when the tournament detail does not exist", async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.getTournamentDetail("missing")).rejects.toMatchObject({
        response: { error: "TOURNAMENT_NOT_FOUND" },
      });
      await expect(service.getTournamentDetail("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
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
});
