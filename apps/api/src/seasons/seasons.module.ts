import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminSeasonsController } from "./admin-seasons.controller.js";
import { SeasonsController } from "./seasons.controller.js";
import { SeasonsService } from "./seasons.service.js";

@Module({
  imports: [AuthModule],
  controllers: [SeasonsController, AdminSeasonsController],
  providers: [SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
