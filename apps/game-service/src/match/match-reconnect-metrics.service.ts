import { Injectable } from "@nestjs/common";
import { Counter, Registry } from "prom-client";

export type MatchReconnectOutcome = "resumed" | "forfeited";

@Injectable()
export class MatchReconnectMetricsService {
  readonly registry = new Registry();
  readonly reconnectTotal: Counter<string>;

  constructor() {
    this.reconnectTotal = new Counter({
      name: "match_reconnect_total",
      help: "Match reconnect attempts by outcome",
      labelNames: ["outcome"],
      registers: [this.registry],
    });
  }

  recordResumed(): void {
    this.reconnectTotal.inc({ outcome: "resumed" });
  }

  recordForfeited(): void {
    this.reconnectTotal.inc({ outcome: "forfeited" });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
