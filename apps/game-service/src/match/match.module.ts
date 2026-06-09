import { Module } from "@nestjs/common";
import { MatchSessionModule } from "../match-session/match-session.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";
import { MatchEventsRelayService } from "./match-events-relay.service.js";
import { MatchPlayService } from "./match-play.service.js";

@Module({
  imports: [RedisModule, MatchSessionModule],
  providers: [MatchPlayService, MatchEventsRelayService, MatchEndedPublisher],
  exports: [MatchPlayService, MatchEventsRelayService],
})
export class MatchModule {}
