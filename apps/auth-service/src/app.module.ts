import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AppConfigModule } from "./config/config.module.js";
import { JWT_CONFIG, type JwtConfig } from "./config/jwt.config.js";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueuesModule } from "./queues/queues.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { UserServiceModule } from "./user-service/user-service.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: [
          "req.headers.authorization",
          "req.body.password",
          "req.body.newPassword",
          "req.body.refreshToken",
          "req.body.token",
        ],
      },
    }),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    QueuesModule,
    UserServiceModule,
    HealthModule,
    JwtModule.registerAsync({
      inject: [JWT_CONFIG],
      useFactory: (config: JwtConfig) => ({
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        signOptions: { algorithm: "RS256" },
      }),
    }),
    AuthModule,
  ],
})
export class AppModule {}
