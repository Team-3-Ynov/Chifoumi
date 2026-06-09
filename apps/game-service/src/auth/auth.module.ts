import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";
import { WsAuthService } from "./ws-auth.service.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [JWT_CONFIG],
      useFactory: (jwtConfig: JwtConfig) => ({
        publicKey: jwtConfig.publicKey,
        verifyOptions: { algorithms: ["RS256"] },
      }),
    }),
  ],
  providers: [WsAuthService],
  exports: [WsAuthService],
})
export class AuthModule {}
