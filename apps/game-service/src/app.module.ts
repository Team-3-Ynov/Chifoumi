import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule],
  providers: [GameGateway],
})
export class AppModule {}
