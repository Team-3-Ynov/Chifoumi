import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AppConfigModule } from "./config/config.module.js";
import { GrpcModule } from "./grpc/grpc.module.js";
import { HealthModule } from "./health/health.module.js";
import { JwksModule } from "./jwks/jwks.module.js";
import { LeaderboardModule } from "./leaderboard/leaderboard.module.js";
import { MatchesModule } from "./matches/matches.module.js";
import { MeModule } from "./me/me.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueuesModule } from "./queues/queues.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: ["req.headers.authorization", "req.body.password", "req.body.refreshToken"],
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: "auth",
        ttl: 60_000,
        limit: 5,
      },
      {
        name: "audit",
        ttl: 60_000,
        limit: 10,
      },
    ]),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    QueuesModule,
    HealthModule,
    UsersModule,
    AuthModule,
    MeModule,
    LeaderboardModule,
    MatchesModule,
    MetricsModule,
    JwksModule,
    GrpcModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
