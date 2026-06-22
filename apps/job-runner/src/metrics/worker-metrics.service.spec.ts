import { describe, expect, it } from "@jest/globals";
import { WorkerMetricsService } from "./worker-metrics.service.js";

describe("WorkerMetricsService", () => {
  it("records processed job counters and duration histograms", async () => {
    const metrics = new WorkerMetricsService();

    metrics.recordJobProcessed("match-events", "completed");
    metrics.recordJobProcessed("match-events", "failed");
    const stopTimer = metrics.startJobTimer("match-events");
    stopTimer();

    const rendered = await metrics.getMetrics();

    expect(rendered).toContain(
      'bullmq_jobs_processed_total{queue="match-events",status="completed"} 1',
    );
    expect(rendered).toContain(
      'bullmq_jobs_processed_total{queue="match-events",status="failed"} 1',
    );
    expect(rendered).toContain('bullmq_job_duration_seconds_count{queue="match-events"} 1');
  });
});
