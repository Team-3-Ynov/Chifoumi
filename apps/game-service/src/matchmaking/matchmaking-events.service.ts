import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import { RedisService } from "../redis/redis.service.js";
import { MATCHMAKING_MATCH_FOUND_CHANNEL, type MatchFoundEvent } from "./matchmaking.constants.js";

@Injectable()
export class MatchmakingEventsService implements OnModuleInit, OnModuleDestroy {
  private server: Server | null = null;
  private subscriber: Redis | null = null;

  constructor(private readonly redisService: RedisService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.subscriber = await this.redisService.subscribe(
      MATCHMAKING_MATCH_FOUND_CHANNEL,
      (message) => {
        this.handleMatchFoundMessage(message);
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
  }

  private handleMatchFoundMessage(message: string): void {
    if (!this.server) {
      return;
    }

    let event: MatchFoundEvent;
    try {
      event = JSON.parse(message) as MatchFoundEvent;
    } catch {
      return;
    }

    void this.emitMatchFound(event);
  }

  private async emitMatchFound(event: MatchFoundEvent): Promise<void> {
    if (!this.server) {
      return;
    }

    const socketId = await this.redisService.getUserSocket(event.userId);
    if (!socketId) {
      return;
    }

    this.server.to(socketId).emit("matchFound", event.payload);
  }
}
