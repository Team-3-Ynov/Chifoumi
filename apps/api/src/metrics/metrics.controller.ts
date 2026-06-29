import { Controller, Get, Header, Inject } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator.js";
import { HttpMetricsMiddleware } from "./http-metrics.middleware.js";

@Public()
@SkipThrottle({ auth: true, audit: true })
@Controller("metrics")
export class MetricsController {
  constructor(@Inject(HttpMetricsMiddleware) private readonly httpMetrics: HttpMetricsMiddleware) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.httpMetrics.getMetrics();
  }
}
