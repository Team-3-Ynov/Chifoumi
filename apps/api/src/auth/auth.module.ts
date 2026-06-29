import { AUTH_PROTO_PACKAGE, AUTH_PROTO_PATH } from "@chifoumi/proto";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { PassportModule } from "@nestjs/passport";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";
import { RedisModule } from "../redis/redis.module.js";
import { UserServiceModule } from "../user-service/user-service.module.js";
import { AuthController } from "./auth.controller.js";
import { AUTH_SERVICE_GRPC_CLIENT, AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE_GRPC_CLIENT,
        useFactory: () => ({
          transport: Transport.GRPC,
          options: {
            package: AUTH_PROTO_PACKAGE,
            protoPath: AUTH_PROTO_PATH,
            url: process.env.AUTH_SERVICE_GRPC_URL ?? "localhost:50054",
          },
        }),
      },
    ]),
    UserServiceModule,
    RedisModule,
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
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
