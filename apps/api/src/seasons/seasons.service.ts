import { type Season, SeasonStatus } from "@chifoumi/db";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { SeasonsQueueService } from "../queues/seasons-queue.service.js";

@Injectable()
export class SeasonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SeasonsQueueService) private readonly seasonsQueue: SeasonsQueueService,
  ) {}

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
