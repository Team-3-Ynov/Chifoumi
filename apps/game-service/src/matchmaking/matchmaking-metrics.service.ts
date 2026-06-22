import { Injectable } from "@nestjs/common";
import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

export type MatchPlayedOutcome = "win" | "draw" | "forfeit";

@Injectable()
export class MatchmakingMetricsService {
  readonly registry = new Registry();
  readonly queueSize: Gauge<string>;
  readonly matchDurationSeconds: Histogram<string>;
  readonly matchPlayedTotal: Counter<string>;

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

    this.matchPlayedTotal = new Counter({
      name: "match_played_total",
      help: "Total completed matches by outcome",
      labelNames: ["outcome"],
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

  recordMatchPlayed(outcome: MatchPlayedOutcome): void {
    this.matchPlayedTotal.inc({ outcome });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
