import { Global, Module } from "@nestjs/common";
import { loadQueueConfig, QUEUE_CONFIG } from "../config/queue.config.js";
import { NotificationsQueueService } from "./notifications-queue.service.js";
import { SeasonsQueueService } from "./seasons-queue.service.js";
import { TournamentsQueueService } from "./tournaments-queue.service.js";

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_CONFIG,
      useFactory: () => loadQueueConfig(),
    },
    NotificationsQueueService,
    SeasonsQueueService,
    TournamentsQueueService,
  ],
  exports: [NotificationsQueueService, SeasonsQueueService, TournamentsQueueService],
})
export class QueuesModule {}
