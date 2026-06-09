import { Global, Module } from "@nestjs/common";
import { JWT_CONFIG, loadJwtConfig } from "./jwt.config.js";
import { loadRedisConfig, REDIS_CONFIG } from "./redis.config.js";

@Global()
@Module({
  providers: [
    {
      provide: JWT_CONFIG,
      useFactory: () => loadJwtConfig(),
    },
    {
      provide: REDIS_CONFIG,
      useFactory: () => loadRedisConfig(),
    },
  ],
  exports: [JWT_CONFIG, REDIS_CONFIG],
})
export class AppConfigModule {}
