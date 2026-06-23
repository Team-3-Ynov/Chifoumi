import { Module } from "@nestjs/common";
import { AdminSeasonsController } from "./admin-seasons.controller.js";
import { SeasonsService } from "./seasons.service.js";
import { SeasonsQueueService } from "./seasons-queue.service.js";

@Module({
  controllers: [AdminSeasonsController],
  providers: [SeasonsService, SeasonsQueueService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
