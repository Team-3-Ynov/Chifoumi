import { Inject, Injectable } from "@nestjs/common";
import { Counter, Registry } from "prom-client";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

@Injectable()
export class WorkerMetricsService {
  readonly registry = new Registry();
  readonly jobsProcessed: Counter<string>;

  constructor(@Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig) {
    this.jobsProcessed = new Counter({
      name: "bullmq_jobs_processed_total",
      help: "Total BullMQ jobs processed by queue, role and status",
      labelNames: ["queue", "role", "status"],
      registers: [this.registry],
    });
  }

  recordJobProcessed(queue: string, status: "completed" | "failed"): void {
    this.jobsProcessed.inc({
      queue,
      role: this.config.WORKER_ROLE,
      status,
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
