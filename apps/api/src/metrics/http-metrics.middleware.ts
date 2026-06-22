import { Injectable, type NestMiddleware } from "@nestjs/common";
import { Counter, Registry } from "prom-client";

type MetricsRequest = {
  baseUrl?: string;
  method?: string;
  originalUrl?: string;
  route?: {
    path?: string;
  };
};

type MetricsResponse = {
  on(event: "finish", listener: () => void): void;
  statusCode: number;
};

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<string>;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests handled by the API",
      labelNames: ["method", "route", "status"],
      registers: [this.registry],
    });
  }

  use(req: MetricsRequest, res: MetricsResponse, next: () => void): void {
    res.on("finish", () => {
      this.httpRequestsTotal.inc({
        method: req.method ?? "UNKNOWN",
        route: this.resolveRoute(req),
        status: String(res.statusCode),
      });
    });

    next();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  private resolveRoute(req: MetricsRequest): string {
    const routePath = req.route?.path;
    if (routePath) {
      return `${req.baseUrl ?? ""}${routePath}`;
    }

    return req.originalUrl?.split("?")[0] ?? "unknown";
  }
}
