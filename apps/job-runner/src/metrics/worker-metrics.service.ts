import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry } from "prom-client";

export type JobProcessedStatus = "completed" | "failed";

@Injectable()
export class WorkerMetricsService {
  readonly registry = new Registry();
  readonly jobsProcessed: Counter<string>;
  readonly jobDurationSeconds: Histogram<string>;

  constructor() {
    this.jobsProcessed = new Counter({
      name: "bullmq_jobs_processed_total",
      help: "Total BullMQ job attempts by queue and status",
      labelNames: ["queue", "status"],
      registers: [this.registry],
    });

    this.jobDurationSeconds = new Histogram({
      name: "bullmq_job_duration_seconds",
      help: "BullMQ job processor duration by queue",
      labelNames: ["queue"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [this.registry],
    });
  }

  recordJobProcessed(queue: string, status: JobProcessedStatus): void {
    this.jobsProcessed.inc({
      queue,
      status,
    });
  }

  startJobTimer(queue: string): () => void {
    return this.jobDurationSeconds.startTimer({ queue });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
