import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_CONFIG, type QueueConfig } from "../config/queue.config.js";

export type GenerateBracketJobData = {
  tournamentId: string;
};

const TOURNAMENTS_QUEUE_NAME = "tournaments";
const GENERATE_BRACKET_JOB_NAME = "generate-bracket";

const GENERATE_BRACKET_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
};

/**
 * Enqueues tournament lifecycle jobs on the shared "tournaments" BullMQ queue.
 * Starting a tournament publishes a `generate-bracket` job consumed by the
 * job-runner `bracket-generator` worker (US-070).
 */
@Injectable()
export class TournamentsQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(@Inject(QUEUE_CONFIG) private readonly queueConfig: QueueConfig) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.queue = new Queue(TOURNAMENTS_QUEUE_NAME, {
      connection: { url: this.queueConfig.redisUrl },
      prefix: this.queueConfig.bullmqPrefix,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async enqueueGenerateBracket(tournamentId: string): Promise<void> {
    const payload: GenerateBracketJobData = { tournamentId };
    await this.requireQueue().add(GENERATE_BRACKET_JOB_NAME, payload, GENERATE_BRACKET_JOB_OPTIONS);
  }

  private requireQueue(): Queue {
    if (!this.queue) {
      throw new Error("Tournaments queue is not connected");
    }

    return this.queue;
  }
}
