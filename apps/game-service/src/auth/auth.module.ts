import { Module } from "@nestjs/common";
import { GrpcClientModule } from "../grpc/grpc-client.module.js";
import { WsAuthService } from "./ws-auth.service.js";

@Module({
  imports: [GrpcClientModule],
  providers: [WsAuthService],
  exports: [WsAuthService],
})
export class AuthModule {}
