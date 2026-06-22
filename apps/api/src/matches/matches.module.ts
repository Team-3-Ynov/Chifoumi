import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuditService } from "./audit.service.js";
import { MatchesController } from "./matches.controller.js";

@Module({
  imports: [PrismaModule],
  controllers: [MatchesController],
  providers: [AuditService],
})
export class MatchesModule {}
