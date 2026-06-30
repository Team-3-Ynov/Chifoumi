import { getReferenceLeagueByName, type ReferenceLeague } from "@chifoumi/leagues";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { LEADERBOARD_CACHE_KEY_PREFIX, RedisService } from "../redis/redis.service.js";
import { UserService } from "../user-service/user.service.js";
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
    @Inject(UserService) private readonly userService: UserService,
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
    return this.userService.listLeaderboard(Math.trunc(Number(limit)), league?.name);
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
}
