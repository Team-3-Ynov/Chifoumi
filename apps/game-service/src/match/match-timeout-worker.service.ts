import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { type Job, Worker } from "bullmq";
import { Logger } from "nestjs-pino";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";
import { MatchPlayService } from "./match-play.service.js";
import { MATCH_TIMEOUT_QUEUE } from "./match-timeout.constants.js";
import type { MatchTimeoutJobPayload } from "./match-timeout.types.js";

@Injectable()
export class MatchTimeoutWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<MatchTimeoutJobPayload> | null = null;

  constructor(
    @Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig,
    private readonly matchPlayService: MatchPlayService,
    private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    if (
      process.env.SKIP_REDIS_CONNECT === "true" ||
      process.env.MATCH_TIMEOUT_WORKER_ENABLED === "false"
    ) {
      return;
    }

    const prefix = process.env.BULLMQ_PREFIX ?? "rps";
    this.worker = new Worker<MatchTimeoutJobPayload>(
      MATCH_TIMEOUT_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: { url: this.redisConfig.url },
        prefix,
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.warn(
        { jobId: job?.id, matchId: job?.data.matchId, error },
        "match timeout job failed",
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.worker = null;
  }

  async processJob(job: Job<MatchTimeoutJobPayload>): Promise<void> {
    const { matchId, roundNumber, expectedState } = job.data;
    await this.matchPlayService.handleMatchTimeout(matchId, roundNumber, expectedState);
  }
}
