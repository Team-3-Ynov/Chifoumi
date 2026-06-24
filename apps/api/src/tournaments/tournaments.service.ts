import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Tournament } from "@prisma/client";
import { TournamentFormat, TournamentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { TournamentsQueueService } from "../queues/tournaments-queue.service.js";

@Injectable()
export class TournamentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TournamentsQueueService) private readonly tournamentsQueue: TournamentsQueueService,
  ) {}

  createTournament(input: {
    name: string;
    format: TournamentFormat;
    bracketSize: number;
    registrationOpensAt: Date;
    startsAt: Date;
  }): Promise<Tournament> {
    return this.prisma.tournament.create({
      data: {
        name: input.name,
        format: input.format,
        bracketSize: input.bracketSize,
        registrationOpensAt: input.registrationOpensAt,
        startsAt: input.startsAt,
        status: TournamentStatus.upcoming,
      },
    });
  }

  async openRegistration(tournamentId: string): Promise<Tournament> {
    const tournament = await this.requireOpenableTournament(tournamentId);

    const openResult = await this.prisma.tournament.updateMany({
      where: { id: tournament.id, status: TournamentStatus.upcoming },
      data: { status: TournamentStatus.registration_open },
    });

    if (openResult.count === 0) {
      await this.requireOpenableTournament(tournamentId);
      throw new ConflictException({ error: "TOURNAMENT_NOT_UPCOMING" });
    }

    return this.requireTournament(tournament.id);
  }

  async startTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.requireStartableTournament(tournamentId);

    const registrationCount = await this.prisma.tournamentRegistration.count({
      where: { tournamentId: tournament.id },
    });

    if (registrationCount < 2) {
      throw new ConflictException({ error: "NOT_ENOUGH_PLAYERS" });
    }

    const startResult = await this.prisma.tournament.updateMany({
      where: { id: tournament.id, status: TournamentStatus.registration_open },
      data: { status: TournamentStatus.in_progress },
    });

    if (startResult.count === 0) {
      await this.requireStartableTournament(tournamentId);
      throw new ConflictException({ error: "TOURNAMENT_NOT_REGISTRATION_OPEN" });
    }

    try {
      await this.tournamentsQueue.enqueueGenerateBracket(tournament.id);
    } catch (error) {
      await this.prisma.tournament.updateMany({
        where: { id: tournament.id, status: TournamentStatus.in_progress },
        data: { status: TournamentStatus.registration_open },
      });
      throw error;
    }

    return this.requireTournament(tournament.id);
  }

  private async requireTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });

    if (!tournament) {
      throw new NotFoundException({ error: "TOURNAMENT_NOT_FOUND" });
    }

    return tournament;
  }

  private async requireOpenableTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.requireTournament(tournamentId);

    if (tournament.status === TournamentStatus.registration_open) {
      throw new ConflictException({ error: "TOURNAMENT_ALREADY_OPEN" });
    }

    if (tournament.status !== TournamentStatus.upcoming) {
      throw new ConflictException({ error: "TOURNAMENT_NOT_UPCOMING" });
    }

    return tournament;
  }

  private async requireStartableTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.requireTournament(tournamentId);

    if (
      tournament.status === TournamentStatus.in_progress ||
      tournament.status === TournamentStatus.completed
    ) {
      throw new ConflictException({ error: "TOURNAMENT_ALREADY_STARTED" });
    }

    if (tournament.status !== TournamentStatus.registration_open) {
      throw new ConflictException({ error: "TOURNAMENT_NOT_REGISTRATION_OPEN" });
    }

    return tournament;
  }
}
