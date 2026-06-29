import { Controller, Get, Header, Inject } from "@nestjs/common";
import { WorkerMetricsService } from "./worker-metrics.service.js";

@Controller("metrics")
export class MetricsController {
  constructor(@Inject(WorkerMetricsService) private readonly workerMetrics: WorkerMetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.workerMetrics.getMetrics();
  }
}
