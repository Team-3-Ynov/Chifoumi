import { Module } from "@nestjs/common";
import { JwksController } from "./jwks.controller.js";

@Module({
  controllers: [JwksController],
})
export class JwksModule {}
