import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { QueueConfig } from "../config/queue.config.js";

const queueAdd = jest.fn<() => Promise<unknown>>();
const queueClose = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("bullmq", () => ({
  Queue: jest.fn(() => ({
    add: queueAdd,
    close: queueClose,
  })),
}));

const { NotificationsQueueService: NotificationsQueueServiceClass } = await import(
  "./notifications-queue.service.js"
);

function createConfig(): QueueConfig {
  return {
    redisUrl: "redis://localhost:6379",
    bullmqPrefix: "rps",
  };
}

describe("NotificationsQueueService", () => {
  beforeEach(() => {
    queueAdd.mockReset();
    queueClose.mockReset();
    queueAdd.mockResolvedValue({ id: "job-1" });
    queueClose.mockResolvedValue();
    delete process.env.SKIP_REDIS_CONNECT;
  });

  it("enqueues welcome mail jobs with retry options", async () => {
    const service = new NotificationsQueueServiceClass(createConfig());
    await service.onModuleInit();

    await service.enqueueWelcomeMail({
      to: "player@example.com",
      displayName: "alice",
    });

    expect(queueAdd).toHaveBeenCalledWith(
      "send-mail",
      {
        to: "player@example.com",
        template: "welcome",
        data: { displayName: "alice" },
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    );
  });
});
