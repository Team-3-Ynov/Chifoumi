import { Module } from "@nestjs/common";
import { WsAuthService } from "./ws-auth.service.js";

@Module({
  providers: [WsAuthService],
  exports: [WsAuthService],
})
export class AuthModule {}
