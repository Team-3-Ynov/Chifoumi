import { Prisma, type Tournament, TournamentFormat, TournamentStatus } from "@chifoumi/db";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { TournamentsQueueService } from "../queues/tournaments-queue.service.js";
import type { TournamentListQueryDto } from "./dto/tournament-query.dto.js";
import type {
  BracketMatchDto,
  BracketRoundDto,
  BracketSlotDto,
  TournamentDetailDto,
  TournamentListItemDto,
  TournamentListResponseDto,
  TournamentRegistrationDto,
} from "./dto/tournament-read-response.dto.js";

type TournamentListRecord = Tournament & {
  _count: { registrations: number };
};

type TournamentRegistrationRecord = {
  userId: string;
  seed: number | null;
  user: {
    displayName: string;
  };
};

type TournamentSlotRecord = {
  id: string;
  displayName: string;
};

type TournamentMatchRecord = {
  id: string;
  round: number;
  matchId: string | null;
  winnerSlot: "a" | "b" | null;
  slotA: TournamentSlotRecord | null;
  slotB: TournamentSlotRecord | null;
  match: {
    scoreA: number;
    scoreB: number;
  } | null;
};

type TournamentDetailRecord = TournamentListRecord & {
  registrations: TournamentRegistrationRecord[];
  matches: TournamentMatchRecord[];
};

@Injectable()
export class TournamentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TournamentsQueueService) private readonly tournamentsQueue: TournamentsQueueService,
  ) {}

  async createTournament(input: {
    name: string;
    format: TournamentFormat;
    bracketSize: number;
    registrationOpensAt: Date;
    startsAt: Date;
  }): Promise<Tournament> {
    if (input.startsAt < input.registrationOpensAt) {
      throw new BadRequestException({ error: "INVALID_TOURNAMENT_SCHEDULE" });
    }

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

  async listTournaments(query: TournamentListQueryDto): Promise<TournamentListResponseDto> {
    const where = query.status ? { status: query.status } : {};
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip,
        take: query.limit,
        include: { _count: { select: { registrations: true } } },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      items: items.map((tournament) => this.toListItem(tournament as TournamentListRecord)),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async getTournamentDetail(tournamentId: string): Promise<TournamentDetailDto> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
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

    if (!tournament) {
      throw new NotFoundException({ error: "TOURNAMENT_NOT_FOUND" });
    }

    const detail = tournament as TournamentDetailRecord;

    return {
      ...this.toListItem(detail),
      registrationOpensAt: detail.registrationOpensAt,
      endedAt: detail.endedAt,
      registrations: this.toRegistrations(detail.registrations),
      bracket: this.toBracket(detail.matches),
    };
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

  private toListItem(tournament: TournamentListRecord): TournamentListItemDto {
    return {
      id: tournament.id,
      name: tournament.name,
      format: tournament.format,
      bracketSize: tournament.bracketSize,
      status: tournament.status,
      registrationsCount: tournament._count.registrations,
      startsAt: tournament.startsAt,
    };
  }

  private toRegistrations(
    registrations: TournamentRegistrationRecord[],
  ): TournamentRegistrationDto[] {
    return [...registrations]
      .sort((left, right) => {
        if (left.seed === null && right.seed === null) {
          return left.user.displayName.localeCompare(right.user.displayName);
        }

        if (left.seed === null) {
          return 1;
        }

        if (right.seed === null) {
          return -1;
        }

        return left.seed - right.seed;
      })
      .map((registration) => ({
        userId: registration.userId,
        displayName: registration.user.displayName,
        seed: registration.seed,
      }));
  }

  private toBracket(matches: TournamentMatchRecord[]): BracketRoundDto[] {
    const rounds = new Map<number, BracketMatchDto[]>();

    for (const match of matches) {
      const roundMatches = rounds.get(match.round) ?? [];
      roundMatches.push({
        id: match.id,
        matchId: match.matchId,
        slotA: this.toSlot(match.slotA),
        slotB: this.toSlot(match.slotB),
        scoreA: match.match?.scoreA ?? null,
        scoreB: match.match?.scoreB ?? null,
        winnerSlot: match.winnerSlot,
      });
      rounds.set(match.round, roundMatches);
    }

    return [...rounds.entries()]
      .sort(([leftRound], [rightRound]) => leftRound - rightRound)
      .map(([round, roundMatches]) => ({
        round,
        matches: roundMatches,
      }));
  }

  private toSlot(slot: TournamentSlotRecord | null): BracketSlotDto | null {
    if (!slot) {
      return null;
    }

    return {
      userId: slot.id,
      displayName: slot.displayName,
    };
  }

  private async requireTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });

    if (!tournament) {
      throw new NotFoundException({ error: "TOURNAMENT_NOT_FOUND" });
    }

    return tournament;
  }

  async registerPlayer(tournamentId: string, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertRegistrationSlotAvailable(tx, tournamentId);

        await tx.tournamentRegistration.create({
          data: { tournamentId, userId },
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({ error: "ALREADY_REGISTERED" });
      }
      throw error;
    }
  }

  async unregisterPlayer(tournamentId: string, userId: string): Promise<void> {
    const tournament = await this.requireTournament(tournamentId);

    if (tournament.status !== TournamentStatus.registration_open) {
      throw new ConflictException({ error: "REGISTRATION_CLOSED" });
    }

    await this.prisma.tournamentRegistration.deleteMany({
      where: { tournamentId, userId },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private async assertRegistrationSlotAvailable(
    tx: Pick<PrismaService, "tournament" | "tournamentRegistration" | "$queryRaw">,
    tournamentId: string,
  ): Promise<Tournament> {
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw new NotFoundException({ error: "TOURNAMENT_NOT_FOUND" });
    }

    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });

    if (!tournament) {
      throw new NotFoundException({ error: "TOURNAMENT_NOT_FOUND" });
    }

    if (tournament.status !== TournamentStatus.registration_open) {
      throw new ConflictException({ error: "REGISTRATION_CLOSED" });
    }

    const registrationCount = await tx.tournamentRegistration.count({
      where: { tournamentId },
    });

    if (registrationCount >= tournament.bracketSize) {
      throw new ConflictException({ error: "TOURNAMENT_FULL" });
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
