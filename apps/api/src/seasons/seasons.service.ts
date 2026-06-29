import { type Season, SeasonStatus } from "@chifoumi/db";
import {
  getLeagueForRating,
  getLeagueProgress,
  getReferenceLeagueByName,
  type ReferenceLeague,
} from "@chifoumi/leagues";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { SeasonsQueueService } from "../queues/seasons-queue.service.js";
import { UserService } from "../user-service/user.service.js";
import type { ClosedSeasonsResponseDto } from "./dto/closed-seasons-response.dto.js";
import type { CurrentSeasonResponseDto } from "./dto/current-season-response.dto.js";
import type { SeasonStandingsResponseDto } from "./dto/season-standings-response.dto.js";

@Injectable()
export class SeasonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SeasonsQueueService) private readonly seasonsQueue: SeasonsQueueService,
    @Inject(UserService) private readonly userService: UserService,
  ) {}

  async getCurrent(userId: string): Promise<CurrentSeasonResponseDto> {
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.active },
    });

    if (!season) {
      throw new NotFoundException({ code: "NO_ACTIVE_SEASON" });
    }

    const stats = await this.userService.getCompetitionStats(userId);

    const leagues = await this.prisma.league.findMany({ orderBy: { tier: "asc" } });
    const league = getLeagueForRating(stats.rating, leagues);
    const progressToNextLeague = getLeagueProgress(stats.rating, league);

    return {
      season: {
        id: season.id,
        name: season.name,
        startedAt: season.startedAt,
        endsAt: season.endsAt,
        status: season.status,
      },
      me: {
        rating: stats.rating,
        league: { name: league.name, tier: league.tier },
        rank: stats.rank,
        progressToNextLeague,
      },
    };
  }

  async getStandings(
    seasonId: string,
    query: { page: number; limit: number; league?: string },
  ): Promise<SeasonStandingsResponseDto> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, status: true },
    });

    if (!season) {
      throw new NotFoundException({ error: "SEASON_NOT_FOUND" });
    }

    if (season.status !== SeasonStatus.closed) {
      throw new ConflictException({ error: "SEASON_NOT_CLOSED" });
    }

    const league = this.resolveLeague(query.league);
    const where = {
      seasonId,
      ...(league ? { finalLeague: { name: league.name } } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.seasonStanding.findMany({
        where,
        orderBy: { rank: "asc" },
        skip,
        take: query.limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
          finalLeague: {
            select: {
              name: true,
              tier: true,
            },
          },
        },
      }),
      this.prisma.seasonStanding.count({ where }),
    ]);

    return {
      season,
      items: items.map((standing) => ({
        rank: standing.rank,
        userId: standing.user.id,
        displayName: standing.user.displayName,
        finalRating: standing.finalRating,
        finalLeague: standing.finalLeague,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async listClosed(): Promise<ClosedSeasonsResponseDto> {
    const items = await this.prisma.season.findMany({
      where: { status: SeasonStatus.closed },
      orderBy: { endsAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        startedAt: true,
        endsAt: true,
        status: true,
      },
    });

    return {
      items: items.map((season) => ({
        ...season,
        status: SeasonStatus.closed,
      })),
    };
  }

  /**
   * Creates a season in the `upcoming` state. The "only one active season"
   * invariant is preserved by construction: a season is never created active,
   * it stays upcoming until a later activation (cron / season-reset).
   */
  createSeason(input: { name: string; endsAt: Date }): Promise<Season> {
    return this.prisma.season.create({
      data: {
        name: input.name,
        startedAt: new Date(),
        endsAt: input.endsAt,
        status: SeasonStatus.upcoming,
      },
    });
  }

  /**
   * Closes the active season and enqueues the same `season-reset` job the
   * monthly cron would publish. Only an active season can be closed.
   */
  async closeSeason(seasonId: string): Promise<Season> {
    const season = await this.requireClosableSeason(seasonId);

    const closeResult = await this.prisma.season.updateMany({
      where: { id: season.id, status: SeasonStatus.active },
      data: { status: SeasonStatus.closed },
    });

    if (closeResult.count === 0) {
      await this.requireClosableSeason(seasonId);
      throw new ConflictException({ error: "SEASON_NOT_ACTIVE" });
    }

    try {
      await this.seasonsQueue.enqueueSeasonReset(season.id);
    } catch (error) {
      await this.prisma.season.updateMany({
        where: { id: season.id, status: SeasonStatus.closed },
        data: { status: SeasonStatus.active },
      });
      throw error;
    }

    const closed = await this.prisma.season.findUnique({ where: { id: season.id } });

    if (!closed) {
      throw new NotFoundException({ error: "SEASON_NOT_FOUND" });
    }

    return closed;
  }

  private resolveLeague(leagueName: string | undefined): ReferenceLeague | null {
    if (!leagueName) {
      return null;
    }

    const league = getReferenceLeagueByName(leagueName);
    if (!league) {
      throw new BadRequestException({ code: "UNKNOWN_LEAGUE" });
    }

    return league;
  }

  private async requireClosableSeason(seasonId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });

    if (!season) {
      throw new NotFoundException({ error: "SEASON_NOT_FOUND" });
    }

    if (season.status === SeasonStatus.closed) {
      throw new ConflictException({ error: "SEASON_ALREADY_CLOSED" });
    }

    if (season.status !== SeasonStatus.active) {
      throw new ConflictException({ error: "SEASON_NOT_ACTIVE" });
    }

    return season;
  }
}
