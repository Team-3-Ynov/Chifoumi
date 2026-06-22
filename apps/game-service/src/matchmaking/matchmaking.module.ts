import { forwardRef, Module } from "@nestjs/common";
import { MatchModule } from "../match/match.module.js";
import { MatchSessionModule } from "../match-session/match-session.module.js";
import { MetricsController } from "../metrics/metrics.controller.js";
import { RedisModule } from "../redis/redis.module.js";
import { MatchmakingGateway } from "./matchmaking.gateway.js";
import { MatchmakingService } from "./matchmaking.service.js";
import { MatchmakingEventsService } from "./matchmaking-events.service.js";
import { MatchmakingMetricsService } from "./matchmaking-metrics.service.js";
import { MatchmakingWorkerService } from "./matchmaking-worker.service.js";
import { RatingService } from "./rating.service.js";

@Module({
  imports: [RedisModule, MatchSessionModule, forwardRef(() => MatchModule)],
  controllers: [MetricsController],
  providers: [
    RatingService,
    MatchmakingService,
    MatchmakingWorkerService,
    MatchmakingEventsService,
    MatchmakingMetricsService,
    MatchmakingGateway,
  ],
  exports: [MatchmakingService, MatchmakingEventsService, MatchmakingMetricsService],
})
export class MatchmakingModule {}
