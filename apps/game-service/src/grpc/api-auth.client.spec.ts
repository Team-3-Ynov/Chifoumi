import { jest } from "@jest/globals";
import { Test } from "@nestjs/testing";
import { of, throwError } from "rxjs";
import { GRPC_CLIENT_CONFIG } from "../config/grpc-client.config.js";
import { ApiAuthClient } from "./api-auth.client.js";
import { AuthTokenCacheService } from "./auth-token-cache.service.js";
import { AuthUnavailableError } from "./auth-unavailable.error.js";
import { AUTH_GRPC_CLIENT } from "./grpc-client.constants.js";
import { GrpcMetricsService } from "./grpc-metrics.service.js";

describe("ApiAuthClient", () => {
  let apiAuthClient: ApiAuthClient;
  const remoteClient = {
    verifyToken: jest.fn(),
  };
  const grpcClient = {
    getService: jest.fn(() => remoteClient),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApiAuthClient,
        AuthTokenCacheService,
        GrpcMetricsService,
        {
          provide: AUTH_GRPC_CLIENT,
          useValue: grpcClient,
        },
        {
          provide: GRPC_CLIENT_CONFIG,
          useValue: { url: "localhost:50051", timeoutMs: 1000 },
        },
      ],
    }).compile();

    apiAuthClient = moduleRef.get(ApiAuthClient);
    apiAuthClient.onModuleInit();
  });

  it("returns valid auth responses from gRPC", async () => {
    remoteClient.verifyToken.mockReturnValue(
      of({
        valid: true,
        userId: "user-1",
        role: "player",
        displayName: "player1",
        jti: "jti-1",
      }),
    );

    await expect(apiAuthClient.verifyToken("token")).resolves.toEqual({
      valid: true,
      userId: "user-1",
      role: "player",
      displayName: "player1",
      jti: "jti-1",
    });
  });

  it("returns invalid auth responses from gRPC", async () => {
    remoteClient.verifyToken.mockReturnValue(
      of({
        valid: false,
        reason: "INVALID",
      }),
    );

    await expect(apiAuthClient.verifyToken("token")).resolves.toEqual({
      valid: false,
      reason: "INVALID",
    });
  });

  it("fails closed when gRPC is unavailable", async () => {
    remoteClient.verifyToken.mockReturnValue(throwError(() => new Error("ECONNREFUSED")));

    await expect(apiAuthClient.verifyToken("token")).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("returns cached valid responses without calling gRPC again", async () => {
    remoteClient.verifyToken.mockReturnValue(
      of({
        valid: true,
        userId: "user-1",
        role: "player",
        displayName: "player1",
        jti: "jti-1",
      }),
    );

    await expect(apiAuthClient.verifyToken("cached-token")).resolves.toMatchObject({ valid: true });
    await expect(apiAuthClient.verifyToken("cached-token")).resolves.toMatchObject({ valid: true });
    expect(remoteClient.verifyToken).toHaveBeenCalledTimes(1);
  });
});
