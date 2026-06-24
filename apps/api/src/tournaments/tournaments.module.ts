import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminTournamentsController } from "./admin-tournaments.controller.js";
import { TournamentsController } from "./tournaments.controller.js";
import { TournamentsService } from "./tournaments.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AdminTournamentsController, TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
