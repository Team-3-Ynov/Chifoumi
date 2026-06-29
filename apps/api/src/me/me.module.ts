import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { MeHistoryService } from "./me-history.service.js";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MeController],
  providers: [MeService, MeHistoryService],
})
export class MeModule {}
