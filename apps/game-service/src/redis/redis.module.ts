import { Module } from "@nestjs/common";
import { loadRedisConfig, REDIS_CONFIG } from "../config/redis.config.js";
import { RedisService } from "./redis.service.js";

@Module({
  providers: [
    {
      provide: REDIS_CONFIG,
      useFactory: () => loadRedisConfig(),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
