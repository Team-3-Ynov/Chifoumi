import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "./config/env.js";
import { type ManagedWorker, WorkerFactory } from "./workers/worker-factory.js";

@Injectable()
export class RunnerService implements OnModuleInit, OnModuleDestroy {
  private workers: ManagedWorker[] = [];

  constructor(
    @Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig,
    @Inject(WorkerFactory)
    private readonly workerFactory: WorkerFactory,
    @Inject(Logger)
    private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    this.workers = this.workerFactory.createWorkers();

    this.logger.log(
      {
        worker_role: this.config.WORKER_ROLE,
        queues: this.config.WORKER_QUEUES,
        concurrency: this.config.WORKER_CONCURRENCY,
        prefix: this.config.BULLMQ_PREFIX,
        cron_enabled: this.config.CRON_ENABLED,
      },
      "job-runner ready",
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map(({ worker }) => worker.close()));
    this.workers = [];
  }
}
