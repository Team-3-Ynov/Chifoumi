import { Inject, Injectable } from "@nestjs/common";
import { UnrecoverableError, Worker, type WorkerOptions } from "bullmq";
import { Logger } from "nestjs-pino";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig, type WorkerQueueName } from "../config/env.js";
import { WorkerMetricsService } from "../metrics/worker-metrics.service.js";
import { MailService } from "../notifications/mail.service.js";
import { MatchPersistenceService } from "../persistence/match-persistence.service.js";
import { RedisInvalidationService } from "../redis/redis-invalidation.service.js";
import { SeasonResetService } from "../seasons/season-reset.service.js";
import { GenerateBracketService } from "../tournaments/generate-bracket.service.js";
import { TournamentProgressionService } from "../tournaments/tournament-progression.service.js";
import { getProcessorForQueue } from "./worker-processors.js";

export type ManagedWorker = {
  queue: WorkerQueueName;
  worker: Worker;
};

@Injectable()
export class WorkerFactory {
  constructor(
    @Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig,
    private readonly metrics: WorkerMetricsService,
    private readonly matchPersistence: MatchPersistenceService,
    private readonly redisInvalidation: RedisInvalidationService,
    private readonly seasonReset: SeasonResetService,
    private readonly tournamentProgression: TournamentProgressionService,
    private readonly generateBracket: GenerateBracketService,
    private readonly mailService: MailService,
    private readonly logger: Logger,
  ) {}

  createWorkers(): ManagedWorker[] {
    return this.config.WORKER_QUEUES.map((queue) => this.createWorker(queue));
  }

  private createWorker(queue: WorkerQueueName): ManagedWorker {
    const workerOptions: WorkerOptions = {
      connection: { url: this.config.REDIS_URL },
      prefix: this.config.BULLMQ_PREFIX,
      concurrency: this.config.WORKER_CONCURRENCY,
    };

    const processor = getProcessorForQueue(queue, {
      matchPersistence: this.matchPersistence,
      redisInvalidation: this.redisInvalidation,
      seasonReset: this.seasonReset,
      tournamentProgression: this.tournamentProgression,
      generateBracket: this.generateBracket,
      mailService: this.mailService,
    });

    const worker = new Worker(
      queue,
      async (job) => {
        const stopTimer = this.metrics.startJobTimer(queue);
        try {
          await processor(job);
        } finally {
          stopTimer();
        }
      },
      workerOptions,
    );

    worker.on("completed", () => {
      this.metrics.recordJobProcessed(queue, "completed");
    });

    worker.on("failed", (job, error) => {
      const isPermanentFailure =
        job &&
        (error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1));
      if (isPermanentFailure) {
        this.metrics.recordJobProcessed(queue, "failed");
      }

      if (queue === "match-events" && job && isPermanentFailure) {
        this.logger.error(
          {
            worker_role: this.config.WORKER_ROLE,
            queue,
            job_name: job.name,
            job_id: job.id,
            matchId: (job.data as { matchId?: string }).matchId,
            attempts_made: job.attemptsMade,
            err: error,
          },
          "Match event job failed permanently",
        );
      }

      if (queue === "notifications" && job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        this.logger.error(
          {
            worker_role: this.config.WORKER_ROLE,
            queue,
            job_name: job.name,
            job_id: job.id,
            to: (job.data as { to?: string }).to,
            template: (job.data as { template?: string }).template,
            attempts_made: job.attemptsMade,
            err: error,
          },
          "Notification job failed permanently",
        );
      }
    });

    worker.on("error", (error) => {
      this.logger.error(
        { worker_role: this.config.WORKER_ROLE, queue, err: error },
        "BullMQ worker error",
      );
    });

    this.logger.log(
      {
        worker_role: this.config.WORKER_ROLE,
        queue,
        concurrency: this.config.WORKER_CONCURRENCY,
        prefix: this.config.BULLMQ_PREFIX,
      },
      "BullMQ worker started",
    );

    return { queue, worker };
  }
}
