import { forwardRef, Module } from "@nestjs/common";
import { MatchModule } from "../match/match.module.js";
import { MatchSessionModule } from "../match-session/match-session.module.js";
import { MatchmakingModule } from "../matchmaking/matchmaking.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { DirectedMatchService } from "./directed-match.service.js";

@Module({
  imports: [RedisModule, MatchSessionModule, MatchmakingModule, forwardRef(() => MatchModule)],
  providers: [DirectedMatchService],
  exports: [DirectedMatchService],
})
export class DirectedMatchModule {}
