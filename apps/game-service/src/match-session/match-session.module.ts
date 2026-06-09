import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module.js";
import { MatchEventBus } from "./match-event-bus.js";
import { MatchSessionService } from "./match-session.service.js";

@Module({
  imports: [RedisModule],
  providers: [MatchEventBus, MatchSessionService],
  exports: [MatchEventBus, MatchSessionService],
})
export class MatchSessionModule {}
