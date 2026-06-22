import { Global, Module } from "@nestjs/common";
import { GrpcClientModule } from "../grpc/grpc-client.module.js";
import { MatchmakingMetricsService } from "../matchmaking/matchmaking-metrics.service.js";
import { MetricsController } from "./metrics.controller.js";

@Global()
@Module({
  imports: [GrpcClientModule],
  controllers: [MetricsController],
  providers: [MatchmakingMetricsService],
  exports: [MatchmakingMetricsService],
})
export class MetricsModule {}
