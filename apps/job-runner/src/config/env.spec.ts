import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  const baseEnv: NodeJS.ProcessEnv = {
    WORKER_QUEUES: "match-events",
    REDIS_URL: "redis://localhost:6379",
    DATABASE_URL: "postgresql://app:password@localhost:5432/chifoumi",
  };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as typeof process.exit);
  });

  it("parses requested queues and defaults", () => {
    const config = loadEnv(baseEnv);

    expect(config.WORKER_QUEUES).toEqual(["match-events"]);
    expect(config.WORKER_CONCURRENCY).toBe(4);
    expect(config.WORKER_ROLE).toBe("match-processor");
    expect(config.BULLMQ_PREFIX).toBe("rps");
    expect(config.CRON_ENABLED).toBe(false);
    expect(config.MAIL_TRANSPORT).toBe("mailhog");
  });

  it("parses multiple queues and custom values", () => {
    const config = loadEnv({
      ...baseEnv,
      WORKER_QUEUES: "match-events,notifications",
      WORKER_CONCURRENCY: "8",
      WORKER_ROLE: "notifier",
      BULLMQ_PREFIX: "rps-staging",
      CRON_ENABLED: "true",
      MAIL_TRANSPORT: "smtp",
    });

    expect(config.WORKER_QUEUES).toEqual(["match-events", "notifications"]);
    expect(config.WORKER_CONCURRENCY).toBe(8);
    expect(config.WORKER_ROLE).toBe("notifier");
    expect(config.BULLMQ_PREFIX).toBe("rps-staging");
    expect(config.CRON_ENABLED).toBe(true);
    expect(config.MAIL_TRANSPORT).toBe("smtp");
  });

  it("fails when REDIS_URL is missing", () => {
    const env = { ...baseEnv };
    delete env.REDIS_URL;

    expect(() => loadEnv(env)).toThrow("process.exit:1");
    expect(console.error).toHaveBeenCalled();
  });

  it("fails when DATABASE_URL is missing", () => {
    const env = { ...baseEnv };
    delete env.DATABASE_URL;

    expect(() => loadEnv(env)).toThrow("process.exit:1");
    expect(console.error).toHaveBeenCalled();
  });
});
