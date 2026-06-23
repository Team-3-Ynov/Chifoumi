import {
  getLeagueSummaryForRating,
  getReferenceLeagueByName,
  type ReferenceLeague,
  toLeagueSummary,
} from "@chifoumi/leagues";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { LEADERBOARD_CACHE_KEY_PREFIX, RedisService } from "../redis/redis.service.js";
import type { LeaderboardResponseDto } from "./dto/leaderboard-response.dto.js";

export const LEADERBOARD_CACHE_TTL_SECONDS = 30;

export type LeaderboardCacheStatus = "HIT" | "MISS";

export type LeaderboardResult = {
  data: LeaderboardResponseDto;
  cache: LeaderboardCacheStatus;
};

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async get(limit: number, leagueName?: string): Promise<LeaderboardResult> {
    const league = this.resolveLeague(leagueName);
    const cacheKey = `${LEADERBOARD_CACHE_KEY_PREFIX}${limit}:${league?.name.toLowerCase() ?? "all"}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return {
        data: JSON.parse(cached) as LeaderboardResponseDto,
        cache: "HIT",
      };
    }

    const data = await this.fetchFromDatabase(limit, league);
    await this.redis.setex(cacheKey, LEADERBOARD_CACHE_TTL_SECONDS, JSON.stringify(data));

    return { data, cache: "MISS" };
  }

  private async fetchFromDatabase(
    limit: number,
    league: ReferenceLeague | null,
  ): Promise<LeaderboardResponseDto> {
    const rows = await this.prisma.eloRating.findMany({
      where: league ? this.toRatingWhere(league) : undefined,
      orderBy: [{ rating: "desc" }, { gamesPlayed: "desc" }],
      take: Math.trunc(Number(limit)),
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    return {
      items: rows.map((row, index) => ({
        rank: index + 1,
        userId: row.user.id,
        displayName: row.user.displayName,
        rating: row.rating,
        gamesPlayed: row.gamesPlayed,
        league: league ? toLeagueSummary(league) : getLeagueSummaryForRating(row.rating),
      })),
    };
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

  private toRatingWhere(league: ReferenceLeague): { rating: { gte: number; lte?: number } } {
    return {
      rating: {
        gte: league.minRating,
        ...(league.maxRating === null ? {} : { lte: league.maxRating }),
      },
    };
  }
}
