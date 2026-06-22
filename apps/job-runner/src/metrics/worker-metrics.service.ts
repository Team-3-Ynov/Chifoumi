import { Inject, Injectable } from "@nestjs/common";
import { Counter, Registry } from "prom-client";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

export type JobProcessedOutcome = "completed" | "retry" | "failed_permanent";

@Injectable()
export class WorkerMetricsService {
  readonly registry = new Registry();
  readonly jobsProcessed: Counter<string>;

  constructor(@Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig) {
    this.jobsProcessed = new Counter({
      name: "bullmq_jobs_processed_total",
      help: "Total BullMQ job attempts by queue, role and outcome (completed, retry, failed_permanent)",
      labelNames: ["queue", "role", "outcome"],
      registers: [this.registry],
    });
  }

  recordJobProcessed(queue: string, outcome: JobProcessedOutcome): void {
    this.jobsProcessed.inc({
      queue,
      role: this.config.WORKER_ROLE,
      outcome,
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
