import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";
import { AuthGrpcController } from "../grpc/auth-grpc.controller.js";
import { AuthVerificationService } from "../grpc/auth-verification.service.js";
import { QueuesModule } from "../queues/queues.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { UserServiceModule } from "../user-service/user-service.module.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

@Module({
  imports: [
    UserServiceModule,
    RedisModule,
    QueuesModule,
    JwtModule.registerAsync({
      inject: [JWT_CONFIG],
      useFactory: (config: JwtConfig) => ({
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        signOptions: { algorithm: "RS256" },
      }),
    }),
  ],
  controllers: [AuthGrpcController],
  providers: [AuthService, AuthVerificationService, PasswordService, TokenService],
  exports: [AuthService, AuthVerificationService],
})
export class AuthModule {}
