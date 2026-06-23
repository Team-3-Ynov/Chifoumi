import { type Season, SeasonStatus } from "@chifoumi/db";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { SeasonsQueueService } from "./seasons-queue.service.js";

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

    const closed = await this.prisma.season.update({
      where: { id: seasonId },
      data: { status: SeasonStatus.closed },
    });

    await this.seasonsQueue.enqueueSeasonReset(closed.id);

    return closed;
  }
}
