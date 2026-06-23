import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry } from "prom-client";

@Injectable()
export class GrpcMetricsService {
  readonly registry = new Registry();
  private readonly callsTotal: Counter<string>;
  private readonly callDurationSeconds: Histogram<string>;

  constructor() {
    this.callsTotal = new Counter({
      name: "grpc_calls_total",
      help: "Total number of outbound gRPC calls from the game service",
      labelNames: ["method", "status"],
      registers: [this.registry],
    });

    this.callDurationSeconds = new Histogram({
      name: "grpc_call_duration_seconds",
      help: "Duration of outbound gRPC calls from the game service",
      labelNames: ["method"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });
  }

  recordCall(method: string, status: "ok" | "error"): void {
    this.callsTotal.inc({ method, status });
  }

  startTimer(method: string): () => void {
    return this.callDurationSeconds.startTimer({ method });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
