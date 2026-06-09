import { Injectable } from "@nestjs/common";
import { collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

@Injectable()
export class MatchmakingMetricsService {
  readonly registry = new Registry();
  readonly queueSize: Gauge<string>;
  readonly matchDurationSeconds: Histogram<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.queueSize = new Gauge({
      name: "matchmaking_queue_size",
      help: "Current number of players waiting in the matchmaking queue",
      registers: [this.registry],
    });

    this.matchDurationSeconds = new Histogram({
      name: "matchmaking_match_duration_seconds",
      help: "Time elapsed between joinQueue and matchFound",
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });
  }

  setQueueSize(size: number): void {
    this.queueSize.set(size);
  }

  observeMatchDuration(queuedAt: number, matchedAt: number): void {
    const elapsedSeconds = (matchedAt - queuedAt) / 1000;
    this.matchDurationSeconds.observe(elapsedSeconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
