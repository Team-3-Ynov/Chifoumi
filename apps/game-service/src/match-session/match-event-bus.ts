import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";
import {
  type MatchSessionEvent,
  type MatchSessionEventPayloads,
  matchChannel,
} from "./match-session.types.js";

export type SerializedMatchEvent<E extends MatchSessionEvent = MatchSessionEvent> = {
  event: E;
  recipientUserId?: string;
  payload: MatchSessionEventPayloads[E];
};

@Injectable()
export class MatchEventBus {
  constructor(private readonly redis: RedisService) {}

  async broadcastToMatch<E extends MatchSessionEvent>(
    matchId: string,
    event: E,
    payload: MatchSessionEventPayloads[E],
    options?: { recipientUserId?: string },
  ): Promise<void> {
    await this.redis.publish(
      matchChannel(matchId),
      JSON.stringify({ event, recipientUserId: options?.recipientUserId, payload }),
    );
  }
}
