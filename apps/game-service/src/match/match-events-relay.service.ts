import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import type { SerializedMatchEvent } from "../match-session/match-event-bus.js";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class MatchEventsRelayService implements OnModuleInit, OnModuleDestroy {
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

    this.subscriber = this.redisService.createSubscriber();
    await this.subscriber.psubscribe("match:*");
    this.subscriber.on("pmessage", (_pattern, _channel, message) => {
      this.handleMatchMessage(message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    const subscriber = this.subscriber;
    this.subscriber = null;
    await subscriber.quit().catch(() => undefined);
  }

  private handleMatchMessage(message: string): void {
    if (!this.server) {
      return;
    }

    let event: SerializedMatchEvent;
    try {
      event = JSON.parse(message) as SerializedMatchEvent;
    } catch {
      return;
    }

    void this.emitToRecipients(event);
  }

  private async emitToRecipients(event: SerializedMatchEvent): Promise<void> {
    if (!this.server) {
      return;
    }

    if (event.recipientUserId) {
      const socketId = await this.redisService.getUserSocket(event.recipientUserId);
      if (socketId) {
        this.server.to(socketId).emit(event.event, event.payload);
      }
      return;
    }

    const payload = event.payload as { matchId?: string };
    if (!payload.matchId) {
      return;
    }

    const stateRaw = await this.redisService.get(`match:${payload.matchId}:state`);
    if (!stateRaw) {
      return;
    }

    let players: Array<{ userId: string }>;
    try {
      const state = JSON.parse(stateRaw) as { players: Array<{ userId: string }> };
      players = state.players;
    } catch {
      return;
    }

    await Promise.all(
      players.map(async (player) => {
        const socketId = await this.redisService.getUserSocket(player.userId);
        if (socketId) {
          this.server?.to(socketId).emit(event.event, event.payload);
        }
      }),
    );
  }
}
