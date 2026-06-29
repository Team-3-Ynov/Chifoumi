import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { Logger } from "nestjs-pino";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

const CRON_LOCK_TTL_SECONDS = 60;

@Injectable()
export class CronSchedulerService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private seasonsQueue: Queue | null = null;
  private lockHeld = false;

  constructor(
    @Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig,
    @Inject(Logger)
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.CRON_ENABLED) {
      this.logger.log(
        { worker_role: this.config.WORKER_ROLE, cron_enabled: false },
        "Cron scheduler disabled",
      );
      return;
    }

    this.redis = new Redis(this.config.REDIS_URL);

    const lockAcquired = await this.acquireSchedulerLock();
    if (!lockAcquired) {
      this.logger.warn(
        { worker_role: this.config.WORKER_ROLE, queue: "seasons" },
        "Cron scheduler lock not acquired; skipping repeatable job registration",
      );
      await this.redis.quit();
      this.redis = null;
      return;
    }

    this.lockHeld = true;
    this.seasonsQueue = new Queue("seasons", {
      connection: { url: this.config.REDIS_URL },
      prefix: this.config.BULLMQ_PREFIX,
    });

    await this.seasonsQueue.add(
      "season-reset",
      { source: "cron-scheduler" },
      {
        repeat: { pattern: "0 0 1 * *" },
        jobId: "season-reset-cron",
      },
    );

    this.logger.log(
      { worker_role: this.config.WORKER_ROLE, queue: "seasons" },
      "Cron scheduler registered repeatable season-reset job",
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.seasonsQueue?.close();
    if (this.lockHeld && this.redis) {
      await this.redis.del(this.cronLockKey());
    }
    await this.redis?.quit();
    this.seasonsQueue = null;
    this.redis = null;
    this.lockHeld = false;
  }

  private cronLockKey(): string {
    return `${this.config.BULLMQ_PREFIX}:job-runner:cron-scheduler-lock`;
  }

  private async acquireSchedulerLock(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    const result = await this.redis.set(
      this.cronLockKey(),
      this.config.WORKER_ROLE,
      "EX",
      CRON_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK";
  }
}
