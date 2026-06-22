import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AppConfigModule } from "./config/config.module.js";
import { GameGateway } from "./game.gateway.js";
import { GrpcClientModule } from "./grpc/grpc-client.module.js";
import { HealthModule } from "./health/health.module.js";
import { MatchModule } from "./match/match.module.js";
import { MatchSessionModule } from "./match-session/match-session.module.js";
import { MatchmakingModule } from "./matchmaking/matchmaking.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: ["req.url", "req.query.token", "req.headers.authorization"],
      },
    }),
    AppConfigModule,
    GrpcClientModule,
    RedisModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    MatchSessionModule,
    MatchModule,
    MatchmakingModule,
  ],
  providers: [GameGateway],
})
export class AppModule {}
