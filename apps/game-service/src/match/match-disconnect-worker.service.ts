import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { type Job, Worker } from "bullmq";
import { Logger } from "nestjs-pino";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";
import { MATCH_DISCONNECT_FORFEIT_QUEUE } from "./match-disconnect.constants.js";
import type { MatchDisconnectForfeitJobPayload } from "./match-disconnect.types.js";
import { MatchPlayService } from "./match-play.service.js";
import { MatchReconnectMetricsService } from "./match-reconnect-metrics.service.js";

@Injectable()
export class MatchDisconnectWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<MatchDisconnectForfeitJobPayload> | null = null;

  constructor(
    @Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig,
    @Inject(MatchPlayService) private readonly matchPlayService: MatchPlayService,
    @Inject(MatchReconnectMetricsService)
    private readonly matchReconnectMetrics: MatchReconnectMetricsService,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    if (
      process.env.SKIP_REDIS_CONNECT === "true" ||
      process.env.MATCH_DISCONNECT_WORKER_ENABLED === "false"
    ) {
      return;
    }

    const prefix = process.env.BULLMQ_PREFIX ?? "rps";
    this.worker = new Worker<MatchDisconnectForfeitJobPayload>(
      MATCH_DISCONNECT_FORFEIT_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: { url: this.redisConfig.url },
        prefix,
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.warn(
        { jobId: job?.id, userId: job?.data.userId, matchId: job?.data.matchId, error },
        "match disconnect forfeit job failed",
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.worker = null;
  }

  async processJob(job: Job<MatchDisconnectForfeitJobPayload>): Promise<void> {
    const forfeited = await this.matchPlayService.handleDisconnectForfeit(
      job.data.userId,
      job.data.matchId,
    );
    if (forfeited) {
      this.matchReconnectMetrics.recordForfeited();
    }
  }
}
