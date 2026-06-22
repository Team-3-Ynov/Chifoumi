import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AuditService } from "./audit.service.js";
import { MatchesController } from "./matches.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [MatchesController],
  providers: [AuditService],
})
export class MatchesModule {}
