import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Logger } from "nestjs-pino";
import type { JobRunnerConfig } from "../config/env.js";
import { WorkerMetricsService } from "../metrics/worker-metrics.service.js";

const workerCtor = jest.fn();

jest.unstable_mockModule("bullmq", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {},
  Worker: workerCtor,
}));

const { WorkerFactory: WorkerFactoryClass } = await import("./worker-factory.js");

function createConfig(overrides: Partial<JobRunnerConfig> = {}): JobRunnerConfig {
  return {
    WORKER_QUEUES: ["match-events"],
    WORKER_CONCURRENCY: 4,
    WORKER_ROLE: "match-processor",
    BULLMQ_PREFIX: "rps",
    REDIS_URL: "redis://localhost:6379",
    DATABASE_URL: "postgresql://app:password@localhost:5432/chifoumi",
    MAIL_TRANSPORT: "mailhog",
    MAIL_HOST: "localhost",
    MAIL_PORT: 1025,
    MAIL_FROM: "noreply@chifoumi.local",
    CRON_ENABLED: false,
    ...overrides,
  };
}

function createMatchPersistence(): { persistMatchEnded: () => Promise<"created"> } {
  return {
    persistMatchEnded: jest.fn(async (): Promise<"created"> => "created"),
  };
}

function createRedisInvalidation(): { invalidateLeaderboard: () => Promise<void> } {
  return {
    invalidateLeaderboard: jest.fn(async () => undefined),
  };
}

function createMailService(): { send: () => Promise<void> } {
  return {
    send: jest.fn(async () => undefined),
  };
}

describe("WorkerFactory", () => {
  beforeEach(() => {
    workerCtor.mockReset();
    workerCtor.mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(async () => undefined),
    }));
  });

  it("instantiates only the requested queues", () => {
    const config = createConfig({ WORKER_QUEUES: ["match-events"] });
    const metrics = new WorkerMetricsService(config);
    const logger = { log: jest.fn() } as unknown as Logger;
    const factory = new WorkerFactoryClass(
      config,
      metrics,
      createMatchPersistence() as never,
      createRedisInvalidation() as never,
      createMailService() as never,
      logger,
    );

    const workers = factory.createWorkers();

    expect(workers).toHaveLength(1);
    expect(workers[0]?.queue).toBe("match-events");
    expect(workerCtor).toHaveBeenCalledTimes(1);
    expect(workerCtor).toHaveBeenCalledWith(
      "match-events",
      expect.any(Function),
      expect.objectContaining({
        connection: { url: config.REDIS_URL },
        prefix: config.BULLMQ_PREFIX,
        concurrency: config.WORKER_CONCURRENCY,
      }),
    );
  });

  it("instantiates multiple workers for multiple queues", () => {
    const config = createConfig({
      WORKER_QUEUES: ["match-events", "notifications"],
      WORKER_CONCURRENCY: 8,
      BULLMQ_PREFIX: "rps-staging",
    });
    const metrics = new WorkerMetricsService(config);
    const logger = { log: jest.fn() } as unknown as Logger;
    const factory = new WorkerFactoryClass(
      config,
      metrics,
      createMatchPersistence() as never,
      createRedisInvalidation() as never,
      createMailService() as never,
      logger,
    );

    const workers = factory.createWorkers();

    expect(workers).toHaveLength(2);
    expect(workers.map((worker) => worker.queue)).toEqual(["match-events", "notifications"]);
    expect(workerCtor).toHaveBeenCalledTimes(2);
    expect(workerCtor).toHaveBeenNthCalledWith(
      1,
      "match-events",
      expect.any(Function),
      expect.objectContaining({ concurrency: 8, prefix: "rps-staging" }),
    );
    expect(workerCtor).toHaveBeenNthCalledWith(
      2,
      "notifications",
      expect.any(Function),
      expect.objectContaining({ concurrency: 8, prefix: "rps-staging" }),
    );
  });
});
