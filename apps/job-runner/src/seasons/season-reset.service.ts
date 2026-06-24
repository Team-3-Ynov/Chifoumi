import { type Season, SeasonStatus } from "@chifoumi/db";
import { softResetRating } from "@chifoumi/elo";
import { getLeagueForRating } from "@chifoumi/leagues";
import { Inject, Injectable } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import type { SeasonResetPayload, SeasonResetResult } from "./season-reset.types.js";
import { SeasonResetLockService } from "./season-reset-lock.service.js";

const MAIL_BATCH_SIZE = 200;

@Injectable()
export class SeasonResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonResetLock: SeasonResetLockService,
    @Inject(NotificationsQueueService)
    private readonly notificationsQueue: NotificationsQueueService,
  ) {}

  async processSeasonReset(payload: SeasonResetPayload): Promise<SeasonResetResult> {
    const season = await this.resolveSeason(payload);
    if (!season) {
      return "noop";
    }

    if (season.status !== SeasonStatus.closed) {
      throw new UnrecoverableError(`Season ${season.id} is not closed`);
    }

    const lockToken = await this.seasonResetLock.acquire(season.id);
    if (!lockToken) {
      throw new Error(`Season reset lock not acquired for ${season.id}`);
    }

    try {
      const existingStandings = await this.prisma.seasonStanding.count({
        where: { seasonId: season.id },
      });

      if (existingStandings > 0) {
        await this.activateNextSeasonIfNeeded();
        await this.enqueuePendingRewardMails(season.id);
        return "already_processed";
      }

      await this.archiveStandingsAndSoftReset(season);
      await this.activateNextSeasonIfNeeded();
      await this.enqueuePendingRewardMails(season.id);
      return "processed";
    } finally {
      await this.seasonResetLock.release(season.id, lockToken);
    }
  }

  private async resolveSeason(payload: SeasonResetPayload): Promise<Season | null> {
    if (payload.seasonId) {
      return this.prisma.season.findUnique({ where: { id: payload.seasonId } });
    }

    const closedPendingReset = await this.prisma.season.findFirst({
      where: {
        status: SeasonStatus.closed,
        OR: [{ standings: { none: {} } }, { standings: { some: { rewardsDistributed: false } } }],
      },
      orderBy: { updatedAt: "asc" },
    });
    if (closedPendingReset) {
      return closedPendingReset;
    }

    const expiredActive = await this.prisma.season.findFirst({
      where: {
        status: SeasonStatus.active,
        endsAt: { lte: new Date() },
      },
    });
    if (!expiredActive) {
      return null;
    }

    const closeResult = await this.prisma.season.updateMany({
      where: { id: expiredActive.id, status: SeasonStatus.active },
      data: { status: SeasonStatus.closed },
    });

    if (closeResult.count === 0) {
      return this.prisma.season.findUnique({ where: { id: expiredActive.id } });
    }

    return { ...expiredActive, status: SeasonStatus.closed };
  }

  private async archiveStandingsAndSoftReset(season: Season): Promise<void> {
    const leagues = await this.prisma.league.findMany({ orderBy: { tier: "asc" } });
    type LeagueRow = (typeof leagues)[number];
    const ratings = await this.prisma.eloRating.findMany({
      orderBy: [{ rating: "desc" }, { gamesPlayed: "desc" }],
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (ratings.length > 0) {
        await tx.seasonStanding.createMany({
          data: ratings.map((entry, index) => {
            const league = getLeagueForRating<LeagueRow>(entry.rating, leagues);
            return {
              seasonId: season.id,
              userId: entry.userId,
              finalRating: entry.rating,
              finalLeagueId: league.id,
              rank: index + 1,
            };
          }),
        });
      }

      for (const entry of ratings) {
        await tx.eloRating.update({
          where: { userId: entry.userId },
          data: {
            rating: softResetRating(entry.rating),
            gamesPlayed: 0,
          },
        });
      }
    });
  }

  private async activateNextSeasonIfNeeded(): Promise<void> {
    const activeCount = await this.prisma.season.count({
      where: { status: SeasonStatus.active },
    });
    if (activeCount > 0) {
      return;
    }

    const upcoming = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.upcoming },
      orderBy: { createdAt: "asc" },
    });
    if (!upcoming) {
      return;
    }

    await this.prisma.season.update({
      where: { id: upcoming.id },
      data: {
        status: SeasonStatus.active,
        startedAt: new Date(),
      },
    });
  }

  private async enqueuePendingRewardMails(seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      return;
    }

    for (;;) {
      const batch = await this.prisma.seasonStanding.findMany({
        where: { seasonId, rewardsDistributed: false },
        include: {
          user: { select: { email: true, displayName: true } },
          finalLeague: { select: { name: true } },
        },
        orderBy: { rank: "asc" },
        take: MAIL_BATCH_SIZE,
      });

      if (batch.length === 0) {
        break;
      }

      for (const standing of batch) {
        const delta = await this.computeDelta(
          standing.userId,
          standing.finalRating,
          season.startedAt,
        );

        await this.notificationsQueue.enqueueSeasonRewardMail({
          to: standing.user.email,
          displayName: SeasonResetService.sanitizeForTemplate(standing.user.displayName),
          seasonName: season.name,
          rank: String(standing.rank),
          leagueName: standing.finalLeague.name,
          finalRating: String(standing.finalRating),
          delta: SeasonResetService.formatDelta(delta),
        });

        await this.prisma.seasonStanding.update({
          where: { id: standing.id },
          data: { rewardsDistributed: true },
        });
      }

      if (batch.length < MAIL_BATCH_SIZE) {
        break;
      }
    }
  }

  private async computeDelta(
    userId: string,
    finalRating: number,
    seasonStartedAt: Date,
  ): Promise<number> {
    const firstEntry = await this.prisma.eloHistory.findFirst({
      where: { userId, createdAt: { gte: seasonStartedAt } },
      orderBy: { createdAt: "asc" },
      select: { ratingBefore: true },
    });
    return firstEntry ? finalRating - firstEntry.ratingBefore : 0;
  }

  private static sanitizeForTemplate(displayName: string): string {
    return displayName.replace(/__[A-Z_]+__/g, "");
  }

  private static formatDelta(delta: number): string {
    if (delta > 0) return `+${delta}`;
    return String(delta);
  }
}
