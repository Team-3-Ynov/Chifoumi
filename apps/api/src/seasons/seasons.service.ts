import { SeasonStatus } from "@chifoumi/db";
import { getLeagueForRating, getLeagueProgress } from "@chifoumi/leagues";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CurrentSeasonResponseDto } from "./dto/current-season-response.dto.js";

// Players always have an elo rating row created at registration, but fall back
// to the platform starting rating defensively (mirrors UsersService).
const STARTING_RATING = 1000;

@Injectable()
export class SeasonsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(userId: string): Promise<CurrentSeasonResponseDto> {
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.active },
    });

    if (!season) {
      throw new NotFoundException({ code: "NO_ACTIVE_SEASON" });
    }

    const eloRating = await this.prisma.eloRating.findUnique({ where: { userId } });
    const rating = eloRating?.rating ?? STARTING_RATING;
    const gamesPlayed = eloRating?.gamesPlayed ?? 0;

    const leagues = await this.prisma.league.findMany({ orderBy: { tier: "asc" } });
    const league = getLeagueForRating(rating, leagues);
    const progressToNextLeague = getLeagueProgress(rating, league);

    const rank = await this.computeRank(rating, gamesPlayed);

    return {
      season: {
        id: season.id,
        name: season.name,
        startedAt: season.startedAt,
        endsAt: season.endsAt,
        status: season.status,
      },
      me: {
        rating,
        league: { name: league.name, tier: league.tier },
        rank,
        progressToNextLeague,
      },
    };
  }

  /**
   * 1-indexed competition rank using the same ordering as the leaderboard
   * (`rating DESC, gamesPlayed DESC`): the number of players strictly ahead
   * plus one.
   */
  private async computeRank(rating: number, gamesPlayed: number): Promise<number> {
    const ahead = await this.prisma.eloRating.count({
      where: {
        OR: [{ rating: { gt: rating } }, { rating, gamesPlayed: { gt: gamesPlayed } }],
      },
    });

    return ahead + 1;
  }
}
