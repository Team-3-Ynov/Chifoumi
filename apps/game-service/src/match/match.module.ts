import { forwardRef, Module } from "@nestjs/common";
import { MatchSessionModule } from "../match-session/match-session.module.js";
import { MatchmakingModule } from "../matchmaking/matchmaking.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { MatchDisconnectSchedulerService } from "./match-disconnect-scheduler.service.js";
import { MatchDisconnectWorkerService } from "./match-disconnect-worker.service.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";
import { MatchEventsRelayService } from "./match-events-relay.service.js";
import { MatchPlayService } from "./match-play.service.js";
import { MatchReconnectService } from "./match-reconnect.service.js";
import { MatchReconnectMetricsService } from "./match-reconnect-metrics.service.js";
import { MatchTimeoutSchedulerService } from "./match-timeout-scheduler.service.js";
import { MatchTimeoutWorkerService } from "./match-timeout-worker.service.js";

@Module({
  imports: [RedisModule, MatchSessionModule, forwardRef(() => MatchmakingModule)],
  providers: [
    MatchPlayService,
    MatchEventsRelayService,
    MatchEndedPublisher,
    MatchTimeoutSchedulerService,
    MatchTimeoutWorkerService,
    MatchDisconnectSchedulerService,
    MatchDisconnectWorkerService,
    MatchReconnectService,
    MatchReconnectMetricsService,
  ],
  exports: [
    MatchPlayService,
    MatchEventsRelayService,
    MatchTimeoutSchedulerService,
    MatchDisconnectSchedulerService,
    MatchReconnectService,
    MatchReconnectMetricsService,
  ],
})
export class MatchModule {}
