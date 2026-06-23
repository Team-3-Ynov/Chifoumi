import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { SeasonsController } from "./seasons.controller.js";
import { SeasonsService } from "./seasons.service.js";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SeasonsController],
  providers: [SeasonsService],
})
export class SeasonsModule {}
