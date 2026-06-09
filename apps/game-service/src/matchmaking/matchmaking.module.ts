import { Module } from "@nestjs/common";
import { MetricsController } from "../metrics/metrics.controller.js";
import { RedisModule } from "../redis/redis.module.js";
import { MatchSessionService } from "./match-session.service.js";
import { MatchmakingGateway } from "./matchmaking.gateway.js";
import { MatchmakingService } from "./matchmaking.service.js";
import { MatchmakingEventsService } from "./matchmaking-events.service.js";
import { MatchmakingMetricsService } from "./matchmaking-metrics.service.js";
import { MatchmakingWorkerService } from "./matchmaking-worker.service.js";
import { RatingService } from "./rating.service.js";

@Module({
  imports: [RedisModule],
  controllers: [MetricsController],
  providers: [
    RatingService,
    MatchmakingService,
    MatchSessionService,
    MatchmakingWorkerService,
    MatchmakingEventsService,
    MatchmakingMetricsService,
    MatchmakingGateway,
  ],
  exports: [MatchmakingService, MatchmakingEventsService, MatchmakingMetricsService],
})
export class MatchmakingModule {}
