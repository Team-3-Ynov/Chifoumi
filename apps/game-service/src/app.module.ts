import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AppConfigModule } from "./config/config.module.js";
import { GameGateway } from "./game.gateway.js";
import { HealthModule } from "./health/health.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: ["req.url", "req.query.token", "req.headers.authorization"],
      },
    }),
    AppConfigModule,
    RedisModule,
    AuthModule,
    HealthModule,
  ],
  providers: [GameGateway],
})
export class AppModule {}
