import { generateKeyPairSync } from "node:crypto";
import { jest } from "@jest/globals";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { RedisService } from "../redis/redis.service.js";
import {
  WS_AUTH_INVALID_TOKEN_CODE,
  WS_AUTH_TOKEN_REVOKED_CODE,
  WsAuthError,
} from "./ws-auth.error.js";
import { WsAuthService } from "./ws-auth.service.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

describe("WsAuthService", () => {
  let wsAuthService: WsAuthService;
  let jwtService: JwtService;
  const redisService = {
    isAccessTokenRevoked: jest.fn<RedisService["isAccessTokenRevoked"]>(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          privateKey,
          publicKey,
          signOptions: { algorithm: "RS256", expiresIn: 60 },
        }),
      ],
      providers: [WsAuthService, { provide: RedisService, useValue: redisService }],
    }).compile();

    wsAuthService = moduleRef.get(WsAuthService);
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redisService.isAccessTokenRevoked.mockResolvedValue(false);
  });

  async function signToken(overrides?: {
    sub?: string;
    displayName?: string;
    jti?: string;
    expiresIn?: number;
  }): Promise<string> {
    return jwtService.signAsync(
      {
        sub: overrides?.sub ?? "user-1",
        role: "player",
        jti: overrides?.jti ?? "jti-1",
        displayName: overrides?.displayName ?? "player1",
      },
      {
        algorithm: "RS256",
        expiresIn: overrides?.expiresIn ?? 60,
      },
    );
  }

  it("accepts a valid non-revoked token", async () => {
    const token = await signToken();
    await expect(wsAuthService.verifyToken(token)).resolves.toEqual({
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

  it("rejects malformed tokens", async () => {
    await expect(wsAuthService.verifyToken("not-a-jwt")).rejects.toBeInstanceOf(WsAuthError);
  });

  it("rejects expired tokens", async () => {
    const token = await signToken({ expiresIn: -1 });
    await expect(wsAuthService.verifyToken(token)).rejects.toMatchObject({
      message: "INVALID_TOKEN",
      code: WS_AUTH_INVALID_TOKEN_CODE,
    });
  });

  it("rejects blacklisted tokens", async () => {
    redisService.isAccessTokenRevoked.mockResolvedValue(true);
    const token = await signToken();
    await expect(wsAuthService.verifyToken(token)).rejects.toMatchObject({
      message: "TOKEN_REVOKED",
      code: WS_AUTH_TOKEN_REVOKED_CODE,
    });
  });
});
