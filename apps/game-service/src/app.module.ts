import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway.js";
import { HealthModule } from "./health/health.module.js";
import { MatchSessionModule } from "./match-session/match-session.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [RedisModule, MatchSessionModule, HealthModule],
  providers: [GameGateway],
})
export class AppModule {}
