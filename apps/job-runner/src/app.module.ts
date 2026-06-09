import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { ConfigModule } from "./config/config.module.js";
import { CronSchedulerService } from "./cron/cron-scheduler.service.js";
import { WorkerMetricsService } from "./metrics/worker-metrics.service.js";
import { RunnerService } from "./runner.service.js";
import { WorkerFactory } from "./workers/worker-factory.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
      },
    }),
    ConfigModule,
  ],
  providers: [WorkerMetricsService, WorkerFactory, CronSchedulerService, RunnerService],
})
export class AppModule {}
