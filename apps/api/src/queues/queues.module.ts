import { Global, Module } from "@nestjs/common";
import { loadQueueConfig, QUEUE_CONFIG } from "../config/queue.config.js";
import { NotificationsQueueService } from "./notifications-queue.service.js";

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_CONFIG,
      useFactory: () => loadQueueConfig(),
    },
    NotificationsQueueService,
  ],
  exports: [NotificationsQueueService],
})
export class QueuesModule {}
