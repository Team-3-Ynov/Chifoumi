import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_CONFIG, type QueueConfig } from "../config/queue.config.js";

export type SeasonResetJobData = {
  seasonId: string;
  source: "admin";
};

const SEASONS_QUEUE_NAME = "seasons";
const SEASON_RESET_JOB_NAME = "season-reset";

const SEASON_RESET_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
};

/**
 * Enqueues season lifecycle jobs on the shared "seasons" BullMQ queue. The
 * job-runner cron registers the same `season-reset` job monthly; closing a
 * season manually publishes an identical job so the demo triggers the exact
 * same downstream processing (archive + soft reset + reward mails).
 */
@Injectable()
export class SeasonsQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(@Inject(QUEUE_CONFIG) private readonly queueConfig: QueueConfig) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.queue = new Queue(SEASONS_QUEUE_NAME, {
      connection: { url: this.queueConfig.redisUrl },
      prefix: this.queueConfig.bullmqPrefix,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async enqueueSeasonReset(seasonId: string): Promise<void> {
    const payload: SeasonResetJobData = { seasonId, source: "admin" };
    await this.requireQueue().add(SEASON_RESET_JOB_NAME, payload, SEASON_RESET_JOB_OPTIONS);
  }

  private requireQueue(): Queue {
    if (!this.queue) {
      throw new Error("Seasons queue is not connected");
    }

    return this.queue;
  }
}
