import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";
import { QueuesModule } from "../queues/queues.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { PasswordService } from "./password.service.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { TokenService } from "./token.service.js";

@Module({
  imports: [
    UsersModule,
    RedisModule,
    QueuesModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [JWT_CONFIG],
      useFactory: (config: JwtConfig) => ({
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        signOptions: { algorithm: "RS256" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
