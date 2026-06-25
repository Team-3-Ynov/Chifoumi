import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";
import type { SendMailJobPayload } from "../notifications/send-mail.types.js";

const NOTIFICATIONS_QUEUE_NAME = "notifications";
const SEND_MAIL_JOB_NAME = "send-mail";

const SEND_MAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
};

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(@Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.queue = new Queue(NOTIFICATIONS_QUEUE_NAME, {
      connection: { url: this.config.REDIS_URL },
      prefix: this.config.BULLMQ_PREFIX,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async enqueueSeasonRewardMail(input: {
    to: string;
    displayName: string;
    seasonName: string;
    rank: string;
    leagueName: string;
    finalRating: string;
    delta: string;
  }): Promise<void> {
    const payload: SendMailJobPayload = {
      to: input.to,
      template: "season-reward",
      data: {
        displayName: input.displayName,
        seasonName: input.seasonName,
        rank: input.rank,
        leagueName: input.leagueName,
        finalRating: input.finalRating,
        delta: input.delta,
      },
    };

    await this.requireQueue().add(SEND_MAIL_JOB_NAME, payload, SEND_MAIL_JOB_OPTIONS);
  }

  async enqueueTournamentStartedMail(input: {
    tournamentId: string;
    userId: string;
    to: string;
    displayName: string;
    tournamentName: string;
  }): Promise<void> {
    const payload: SendMailJobPayload = {
      to: input.to,
      template: "tournament-started",
      data: {
        displayName: input.displayName,
        tournamentName: input.tournamentName,
      },
    };

    await this.requireQueue().add(SEND_MAIL_JOB_NAME, payload, {
      ...SEND_MAIL_JOB_OPTIONS,
      jobId: `tournament-started:${input.tournamentId}:${input.userId}`,
    });
  }

  private requireQueue(): Queue {
    if (!this.queue) {
      throw new Error("Notifications queue is not connected");
    }

    return this.queue;
  }
}
