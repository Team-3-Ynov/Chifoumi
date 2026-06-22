import { Controller, Get, Header } from "@nestjs/common";
import { GrpcMetricsService } from "../grpc/grpc-metrics.service.js";
import { MatchReconnectMetricsService } from "../match/match-reconnect-metrics.service.js";
import { MatchmakingMetricsService } from "../matchmaking/matchmaking-metrics.service.js";

@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly matchmakingMetricsService: MatchmakingMetricsService,
    private readonly grpcMetricsService: GrpcMetricsService,
    private readonly matchReconnectMetricsService: MatchReconnectMetricsService,
  ) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    const [matchmakingMetrics, grpcMetrics, reconnectMetrics] = await Promise.all([
      this.matchmakingMetricsService.getMetrics(),
      this.grpcMetricsService.getMetrics(),
      this.matchReconnectMetricsService.getMetrics(),
    ]);
    return `${matchmakingMetrics}\n${grpcMetrics}\n${reconnectMetrics}`;
  }
}
