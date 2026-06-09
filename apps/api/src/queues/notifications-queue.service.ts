import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_CONFIG, type QueueConfig } from "../config/queue.config.js";

export type SendMailJobData = {
  to: string;
  template: string;
  data: Record<string, string>;
};

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

  constructor(@Inject(QUEUE_CONFIG) private readonly queueConfig: QueueConfig) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.queue = new Queue(NOTIFICATIONS_QUEUE_NAME, {
      connection: { url: this.queueConfig.redisUrl },
      prefix: this.queueConfig.bullmqPrefix,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async enqueueWelcomeMail(input: { to: string; displayName: string }): Promise<void> {
    await this.enqueueSendMail({
      to: input.to,
      template: "welcome",
      data: { displayName: input.displayName },
    });
  }

  async enqueueSendMail(payload: SendMailJobData): Promise<void> {
    await this.requireQueue().add(SEND_MAIL_JOB_NAME, payload, SEND_MAIL_JOB_OPTIONS);
  }

  private requireQueue(): Queue {
    if (!this.queue) {
      throw new Error("Notifications queue is not connected");
    }

    return this.queue;
  }
}
