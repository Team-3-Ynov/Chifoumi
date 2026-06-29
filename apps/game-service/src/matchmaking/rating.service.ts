import { Inject, Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";
import { DEFAULT_RATING, USER_RATING_PREFIX } from "./matchmaking.constants.js";

@Injectable()
export class RatingService {
  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  async getRating(userId: string): Promise<number> {
    const stored = await this.redisService.get(`${USER_RATING_PREFIX}${userId}`);
    if (!stored) {
      return DEFAULT_RATING;
    }

    const rating = Number.parseInt(stored, 10);
    return Number.isFinite(rating) ? rating : DEFAULT_RATING;
  }
}
