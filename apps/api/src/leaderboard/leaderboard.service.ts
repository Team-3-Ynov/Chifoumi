import { Injectable } from "@nestjs/common";
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
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get(limit: number): Promise<LeaderboardResult> {
    const cacheKey = `${LEADERBOARD_CACHE_KEY_PREFIX}${limit}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return {
        data: JSON.parse(cached) as LeaderboardResponseDto,
        cache: "HIT",
      };
    }

    const data = await this.fetchFromDatabase(limit);
    await this.redis.setex(cacheKey, LEADERBOARD_CACHE_TTL_SECONDS, JSON.stringify(data));

    return { data, cache: "MISS" };
  }

  private async fetchFromDatabase(limit: number): Promise<LeaderboardResponseDto> {
    const rows = await this.prisma.eloRating.findMany({
      orderBy: [{ rating: "desc" }, { gamesPlayed: "desc" }],
      take: limit,
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
      })),
    };
  }
}
