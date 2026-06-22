import { Module } from "@nestjs/common";
import { MatchSessionModule } from "../match-session/match-session.module.js";
import { MetricsModule } from "../metrics/metrics.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";
import { MatchEventsRelayService } from "./match-events-relay.service.js";
import { MatchPlayService } from "./match-play.service.js";
import { MatchTimeoutSchedulerService } from "./match-timeout-scheduler.service.js";
import { MatchTimeoutWorkerService } from "./match-timeout-worker.service.js";

@Module({
  imports: [RedisModule, MatchSessionModule, MetricsModule],
  providers: [
    MatchPlayService,
    MatchEventsRelayService,
    MatchEndedPublisher,
    MatchTimeoutSchedulerService,
    MatchTimeoutWorkerService,
  ],
  exports: [MatchPlayService, MatchEventsRelayService, MatchTimeoutSchedulerService],
})
export class MatchModule {}
