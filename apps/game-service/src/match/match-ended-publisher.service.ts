import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";
import type { MatchEndedPayload, MatchState } from "../match-session/match-session.types.js";

export type MatchEndedJobPayload = MatchEndedPayload & {
  players: MatchState["players"];
  endReason: MatchState["endReason"];
  startedAt: string;
};

@Injectable()
export class MatchEndedPublisher implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(@Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig) {}

  onModuleInit(): void {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    const prefix = process.env.BULLMQ_PREFIX ?? "rps";
    this.queue = new Queue("match-events", {
      connection: { url: this.redisConfig.url },
      prefix,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async publishMatchEnded(state: MatchState): Promise<void> {
    if (!this.queue) {
      return;
    }

    const payload: MatchEndedJobPayload = {
      matchId: state.matchId,
      winner: state.winnerId ?? null,
      finalScore: { a: state.scoreA, b: state.scoreB },
      eloDelta: { a: 0, b: 0 },
      reason: state.endReason,
      players: state.players,
      endReason: state.endReason,
      startedAt: state.startedAt,
    };

    await this.queue.add("match-ended", payload, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
