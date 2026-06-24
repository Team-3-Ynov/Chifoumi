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

const { TournamentsQueueService: TournamentsQueueServiceClass } = await import(
  "./tournaments-queue.service.js"
);

function createConfig(): QueueConfig {
  return {
    redisUrl: "redis://localhost:6379",
    bullmqPrefix: "rps",
  };
}

describe("TournamentsQueueService", () => {
  beforeEach(() => {
    queueAdd.mockReset();
    queueClose.mockReset();
    queueAdd.mockResolvedValue({ id: "job-1" });
    queueClose.mockResolvedValue();
    delete process.env.SKIP_REDIS_CONNECT;
  });

  it("enqueues a generate-bracket job with retry options and the tournament id", async () => {
    const service = new TournamentsQueueServiceClass(createConfig());
    await service.onModuleInit();

    await service.enqueueGenerateBracket("tournament-1");

    expect(queueAdd).toHaveBeenCalledWith(
      "generate-bracket",
      { tournamentId: "tournament-1" },
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
    const service = new TournamentsQueueServiceClass(createConfig());
    await service.onModuleInit();

    await expect(service.enqueueGenerateBracket("tournament-1")).rejects.toThrow(
      "Tournaments queue is not connected",
    );
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
