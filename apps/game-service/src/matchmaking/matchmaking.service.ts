import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";
import {
  MATCH_BY_USER_PREFIX,
  MATCHMAKING_LOCK_PREFIX,
  MATCHMAKING_LOCK_TTL_SECONDS,
  MATCHMAKING_QUEUE_KEY,
  MATCHMAKING_RATE_LIMIT_TTL_SECONDS,
  MATCHMAKING_RATE_PREFIX,
  matchByUserKey,
  matchmakingMetaKey,
  type QueueMemberMeta,
} from "./matchmaking.constants.js";
import { RatingService } from "./rating.service.js";

export type JoinQueueResult =
  | { ok: true; queuedAt: number; currentRating: number }
  | { ok: false; code: "ALREADY_IN_QUEUE" | "ALREADY_IN_MATCH" | "RATE_LIMITED" };

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly redisService: RedisService,
    private readonly ratingService: RatingService,
  ) {}

  async joinQueue(userId: string, displayName: string): Promise<JoinQueueResult> {
    const existingMatch = await this.redisService.get(matchByUserKey(userId));
    if (existingMatch) {
      return { ok: false, code: "ALREADY_IN_MATCH" };
    }

    const queueScore = await this.redisService.getClient().zscore(MATCHMAKING_QUEUE_KEY, userId);
    if (queueScore !== null) {
      return { ok: false, code: "ALREADY_IN_QUEUE" };
    }

    const rateCount = await this.redisService.incrWithExpiry(
      `${MATCHMAKING_RATE_PREFIX}${userId}`,
      MATCHMAKING_RATE_LIMIT_TTL_SECONDS,
    );
    if (rateCount > 1) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    const lockKey = `${MATCHMAKING_LOCK_PREFIX}${userId}`;
    const lockAcquired = await this.redisService.setnx(lockKey, MATCHMAKING_LOCK_TTL_SECONDS);
    if (!lockAcquired) {
      return { ok: false, code: "ALREADY_IN_QUEUE" };
    }

    try {
      const queueScoreAfterLock = await this.redisService
        .getClient()
        .zscore(MATCHMAKING_QUEUE_KEY, userId);
      if (queueScoreAfterLock !== null) {
        return { ok: false, code: "ALREADY_IN_QUEUE" };
      }

      const rating = await this.ratingService.getRating(userId);
      const queuedAt = Date.now();

      await this.redisService.zadd(MATCHMAKING_QUEUE_KEY, rating, userId);
      await this.redisService.hset(matchmakingMetaKey(userId), {
        userId,
        rating: String(rating),
        displayName,
        queuedAt: String(queuedAt),
      });

      return { ok: true, queuedAt, currentRating: rating };
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  async leaveQueue(userId: string): Promise<boolean> {
    const removed = await this.redisService.getClient().zrem(MATCHMAKING_QUEUE_KEY, userId);
    await this.redisService.del(matchmakingMetaKey(userId));
    return Number(removed) > 0;
  }

  async isInQueue(userId: string): Promise<boolean> {
    const score = await this.redisService.getClient().zscore(MATCHMAKING_QUEUE_KEY, userId);
    return score !== null;
  }

  async isInMatch(userId: string): Promise<boolean> {
    const matchId = await this.redisService.get(matchByUserKey(userId));
    return matchId !== null;
  }

  async getQueueSize(): Promise<number> {
    return this.redisService.zcard(MATCHMAKING_QUEUE_KEY);
  }

  async listQueueMembers(): Promise<QueueMemberMeta[]> {
    const entries = await this.redisService.zrangeWithScores(MATCHMAKING_QUEUE_KEY);
    const members: QueueMemberMeta[] = [];

    for (const entry of entries) {
      const meta = await this.redisService.hgetall(matchmakingMetaKey(entry.userId));
      if (!meta.userId || !meta.displayName || !meta.queuedAt || !meta.rating) {
        continue;
      }

      members.push({
        userId: meta.userId,
        displayName: meta.displayName,
        rating: Number.parseInt(meta.rating, 10),
        queuedAt: Number.parseInt(meta.queuedAt, 10),
      });
    }

    return members.sort((left, right) => left.queuedAt - right.queuedAt);
  }

  async getMatchIdForUser(userId: string): Promise<string | null> {
    return this.redisService.get(`${MATCH_BY_USER_PREFIX}${userId}`);
  }
}
