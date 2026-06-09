import { Controller, Get, Header } from "@nestjs/common";
import { MatchmakingMetricsService } from "../matchmaking/matchmaking-metrics.service.js";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly matchmakingMetricsService: MatchmakingMetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.matchmakingMetricsService.getMetrics();
  }
}
