import { AUTH_PROTO_PACKAGE, AUTH_PROTO_PATH } from "@chifoumi/proto";
import { Global, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { GRPC_CLIENT_CONFIG, type GrpcClientConfig } from "../config/grpc-client.config.js";
import { API_AUTH_CLIENT, ApiAuthClient } from "./api-auth.client.js";
import { AuthTokenCacheService } from "./auth-token-cache.service.js";
import { AUTH_GRPC_CLIENT } from "./grpc-client.constants.js";
import { GrpcMetricsService } from "./grpc-metrics.service.js";

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: AUTH_GRPC_CLIENT,
        inject: [GRPC_CLIENT_CONFIG],
        useFactory: (config: GrpcClientConfig) => ({
          transport: Transport.GRPC,
          options: {
            package: AUTH_PROTO_PACKAGE,
            protoPath: AUTH_PROTO_PATH,
            url: config.url,
          },
        }),
      },
    ]),
  ],
  providers: [
    AuthTokenCacheService,
    GrpcMetricsService,
    ApiAuthClient,
    {
      provide: API_AUTH_CLIENT,
      useExisting: ApiAuthClient,
    },
  ],
  exports: [API_AUTH_CLIENT, GrpcMetricsService, AuthTokenCacheService],
})
export class GrpcClientModule {}
