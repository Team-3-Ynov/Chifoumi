import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { ConfigModule } from "./config/config.module.js";
import { CronSchedulerService } from "./cron/cron-scheduler.service.js";
import { MetricsController } from "./metrics/metrics.controller.js";
import { WorkerMetricsService } from "./metrics/worker-metrics.service.js";
import { MailService } from "./notifications/mail.service.js";
import { TemplateService } from "./notifications/template.service.js";
import { MatchPersistenceService } from "./persistence/match-persistence.service.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisInvalidationService } from "./redis/redis-invalidation.service.js";
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
    PrismaModule,
  ],
  controllers: [MetricsController],
  providers: [
    WorkerMetricsService,
    TemplateService,
    MailService,
    MatchPersistenceService,
    RedisInvalidationService,
    WorkerFactory,
    CronSchedulerService,
    RunnerService,
  ],
})
export class AppModule {}
