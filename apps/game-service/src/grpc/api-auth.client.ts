import type { VerifyTokenResponse } from "@chifoumi/proto";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, timeout } from "rxjs";
import { GRPC_CLIENT_CONFIG, type GrpcClientConfig } from "../config/grpc-client.config.js";
import { AuthTokenCacheService } from "./auth-token-cache.service.js";
import { AuthUnavailableError } from "./auth-unavailable.error.js";
import { AUTH_GRPC_CLIENT } from "./grpc-client.constants.js";
import { GrpcMetricsService } from "./grpc-metrics.service.js";

type AuthGrpcService = {
  verifyToken(request: { token: string }): import("rxjs").Observable<{
    valid: boolean;
    userId?: string;
    role?: string;
    displayName?: string;
    reason?: string;
    jti?: string;
  }>;
};

function mapVerifyTokenResponse(response: {
  valid: boolean;
  userId?: string;
  role?: string;
  displayName?: string;
  reason?: string;
  jti?: string;
}): VerifyTokenResponse {
  if (!response.valid) {
    const reason =
      response.reason === "REVOKED" ||
      response.reason === "EXPIRED" ||
      response.reason === "INVALID" ||
      response.reason === "UNAVAILABLE"
        ? response.reason
        : "INVALID";
    return { valid: false, reason };
  }

  return {
    valid: true,
    userId: response.userId,
    role: response.role,
    displayName: response.displayName,
    jti: response.jti,
  };
}

@Injectable()
export class ApiAuthClient implements OnModuleInit {
  private authService!: AuthGrpcService;

  constructor(
    @Inject(AUTH_GRPC_CLIENT) private readonly client: ClientGrpc,
    @Inject(GRPC_CLIENT_CONFIG) private readonly grpcConfig: GrpcClientConfig,
    @Inject(AuthTokenCacheService) private readonly cache: AuthTokenCacheService,
    @Inject(GrpcMetricsService) private readonly metrics: GrpcMetricsService,
  ) {}

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcService>("Auth");
  }

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    const cached = this.cache.get(token);
    if (cached) {
      return cached;
    }

    const stopTimer = this.metrics.startTimer("VerifyToken");
    try {
      const response = await firstValueFrom(
        this.authService.verifyToken({ token }).pipe(timeout(this.grpcConfig.timeoutMs)),
      );
      const result = mapVerifyTokenResponse(response);

      if (result.valid) {
        this.cache.set(token, result);
      } else {
        this.cache.invalidate(token);
      }

      this.metrics.recordCall("VerifyToken", "ok");
      return result;
    } catch {
      this.metrics.recordCall("VerifyToken", "error");
      throw new AuthUnavailableError();
    } finally {
      stopTimer();
    }
  }
}

export const API_AUTH_CLIENT = "API_AUTH_CLIENT";
