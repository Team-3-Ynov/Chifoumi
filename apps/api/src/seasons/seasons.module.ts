import { Module } from "@nestjs/common";
import { AdminSeasonsController } from "./admin-seasons.controller.js";
import { SeasonsService } from "./seasons.service.js";

@Module({
  controllers: [AdminSeasonsController],
  providers: [SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
