import { jest } from "@jest/globals";
import { Test } from "@nestjs/testing";
import { API_AUTH_CLIENT, type ApiAuthClient } from "../grpc/api-auth.client.js";
import { AuthUnavailableError } from "../grpc/auth-unavailable.error.js";
import {
  WS_AUTH_INVALID_TOKEN_CODE,
  WS_AUTH_TOKEN_REVOKED_CODE,
  WS_AUTH_UNAVAILABLE_CODE,
} from "./ws-auth.error.js";
import { WsAuthService } from "./ws-auth.service.js";

describe("WsAuthService", () => {
  let wsAuthService: WsAuthService;
  const apiAuthClient = {
    verifyToken: jest.fn<ApiAuthClient["verifyToken"]>(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [WsAuthService, { provide: API_AUTH_CLIENT, useValue: apiAuthClient }],
    }).compile();

    wsAuthService = moduleRef.get(WsAuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token from the API client", async () => {
    apiAuthClient.verifyToken.mockResolvedValue({
      valid: true,
      userId: "user-1",
      displayName: "player1",
      role: "player",
      jti: "jti-1",
    });

    await expect(wsAuthService.verifyToken("token")).resolves.toEqual({
      userId: "user-1",
      displayName: "player1",
      jti: "jti-1",
    });
  });

  it("rejects missing tokens", async () => {
    await expect(wsAuthService.verifyToken(undefined)).rejects.toMatchObject({
      message: "INVALID_TOKEN",
      code: WS_AUTH_INVALID_TOKEN_CODE,
    });
  });

  it("rejects invalid tokens", async () => {
    apiAuthClient.verifyToken.mockResolvedValue({ valid: false, reason: "INVALID" });
    await expect(wsAuthService.verifyToken("bad-token")).rejects.toMatchObject({
      message: "INVALID_TOKEN",
      code: WS_AUTH_INVALID_TOKEN_CODE,
    });
  });

  it("rejects revoked tokens", async () => {
    apiAuthClient.verifyToken.mockResolvedValue({ valid: false, reason: "REVOKED" });
    await expect(wsAuthService.verifyToken("revoked-token")).rejects.toMatchObject({
      message: "TOKEN_REVOKED",
      code: WS_AUTH_TOKEN_REVOKED_CODE,
    });
  });

  it("fails closed when the API reports auth unavailable", async () => {
    apiAuthClient.verifyToken.mockResolvedValue({ valid: false, reason: "UNAVAILABLE" });
    await expect(wsAuthService.verifyToken("token")).rejects.toMatchObject({
      message: "AUTH_UNAVAILABLE",
      code: WS_AUTH_UNAVAILABLE_CODE,
    });
  });

  it("fails closed when the API client is unavailable", async () => {
    apiAuthClient.verifyToken.mockRejectedValue(new AuthUnavailableError());
    await expect(wsAuthService.verifyToken("token")).rejects.toMatchObject({
      message: "AUTH_UNAVAILABLE",
      code: WS_AUTH_UNAVAILABLE_CODE,
    });
  });
});
