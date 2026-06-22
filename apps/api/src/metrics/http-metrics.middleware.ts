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
  private static readonly registry = new Registry();
  private static readonly httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests handled by the API",
    labelNames: ["method", "route", "status"],
    registers: [HttpMetricsMiddleware.registry],
  });

  use(req: MetricsRequest, res: MetricsResponse, next: () => void): void {
    res.on("finish", () => {
      HttpMetricsMiddleware.httpRequestsTotal.inc({
        method: req.method ?? "UNKNOWN",
        route: this.resolveRoute(req),
        status: String(res.statusCode),
      });
    });

    next();
  }

  async getMetrics(): Promise<string> {
    return HttpMetricsMiddleware.registry.metrics();
  }

  private resolveRoute(req: MetricsRequest): string {
    const routePath = req.route?.path;
    if (routePath) {
      if (routePath === "{*path}" || routePath === "/{*path}") {
        return "unmatched";
      }
      return `${req.baseUrl ?? ""}${routePath}`;
    }

    return this.normalizePath(req.originalUrl?.split("?")[0]);
  }

  private normalizePath(path: string | undefined): string {
    if (!path) {
      return "unmatched";
    }

    if (
      [
        "/health",
        "/metrics",
        "/.well-known/jwks.json",
        "/auth/register",
        "/auth/login",
        "/auth/refresh",
        "/auth/logout",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/me",
        "/me/history",
        "/leaderboard",
      ].includes(path)
    ) {
      return path;
    }

    if (/^\/users\/[^/]+\/profile$/.test(path)) {
      return "/users/:id/profile";
    }

    if (/^\/matches\/[^/]+\/audit$/.test(path)) {
      return "/matches/:id/audit";
    }

    return "unmatched";
  }
}
