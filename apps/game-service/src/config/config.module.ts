import { Global, Module } from "@nestjs/common";
import { GRPC_CLIENT_CONFIG, loadGrpcClientConfig } from "./grpc-client.config.js";
import { loadRedisConfig, REDIS_CONFIG } from "./redis.config.js";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONFIG,
      useFactory: () => loadRedisConfig(),
    },
    {
      provide: GRPC_CLIENT_CONFIG,
      useFactory: () => loadGrpcClientConfig(),
    },
  ],
  exports: [REDIS_CONFIG, GRPC_CLIENT_CONFIG],
})
export class AppConfigModule {}
