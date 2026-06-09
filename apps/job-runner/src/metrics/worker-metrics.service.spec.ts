import { describe, expect, it } from "@jest/globals";
import type { JobRunnerConfig } from "../config/env.js";
import { WorkerMetricsService } from "./worker-metrics.service.js";

function createConfig(): JobRunnerConfig {
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
  };
}

describe("WorkerMetricsService", () => {
  it("records completed, retry and permanent failure outcomes", async () => {
    const metrics = new WorkerMetricsService(createConfig());

    metrics.recordJobProcessed("match-events", "completed");
    metrics.recordJobProcessed("match-events", "retry");
    metrics.recordJobProcessed("match-events", "failed_permanent");

    const rendered = await metrics.getMetrics();

    expect(rendered).toContain(
      'bullmq_jobs_processed_total{queue="match-events",role="match-processor",outcome="completed"} 1',
    );
    expect(rendered).toContain(
      'bullmq_jobs_processed_total{queue="match-events",role="match-processor",outcome="retry"} 1',
    );
    expect(rendered).toContain(
      'bullmq_jobs_processed_total{queue="match-events",role="match-processor",outcome="failed_permanent"} 1',
    );
  });
});
