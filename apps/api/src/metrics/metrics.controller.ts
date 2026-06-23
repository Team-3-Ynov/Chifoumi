import { Controller, Get, Header } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { HttpMetricsMiddleware } from "./http-metrics.middleware.js";

@SkipThrottle({ auth: true, audit: true })
@Controller("metrics")
export class MetricsController {
  constructor(private readonly httpMetrics: HttpMetricsMiddleware) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.httpMetrics.getMetrics();
  }
}
