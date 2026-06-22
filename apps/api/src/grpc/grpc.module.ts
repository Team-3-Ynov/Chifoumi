import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";
import { RedisModule } from "../redis/redis.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthGrpcController } from "./auth-grpc.controller.js";
import { AuthVerificationService } from "./auth-verification.service.js";
import { UsersGrpcController } from "./users-grpc.controller.js";

@Module({
  imports: [
    RedisModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [JWT_CONFIG],
      useFactory: (config: JwtConfig) => ({
        publicKey: config.publicKey,
        verifyOptions: { algorithms: ["RS256"] },
      }),
    }),
  ],
  controllers: [AuthGrpcController, UsersGrpcController],
  providers: [AuthVerificationService],
  exports: [AuthVerificationService],
})
export class GrpcModule {}
