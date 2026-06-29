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

const { SeasonsQueueService: SeasonsQueueServiceClass } = await import(
  "./seasons-queue.service.js"
);

function createConfig(): QueueConfig {
  return {
    redisUrl: "redis://localhost:6379",
    bullmqPrefix: "rps",
  };
}

describe("SeasonsQueueService", () => {
  beforeEach(() => {
    queueAdd.mockReset();
    queueClose.mockReset();
    queueAdd.mockResolvedValue({ id: "job-1" });
    queueClose.mockResolvedValue();
    delete process.env.SKIP_REDIS_CONNECT;
  });

  it("enqueues a season-reset job with retry options and the season id", async () => {
    const service = new SeasonsQueueServiceClass(createConfig());
    await service.onModuleInit();

    await service.enqueueSeasonReset("season-1");

    expect(queueAdd).toHaveBeenCalledWith(
      "season-reset",
      { seasonId: "season-1", source: "admin" },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    );
  });

  it("throws when the queue is not connected", async () => {
    process.env.SKIP_REDIS_CONNECT = "true";
    const service = new SeasonsQueueServiceClass(createConfig());
    await service.onModuleInit();

    await expect(service.enqueueSeasonReset("season-1")).rejects.toThrow(
      "Seasons queue is not connected",
    );
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
