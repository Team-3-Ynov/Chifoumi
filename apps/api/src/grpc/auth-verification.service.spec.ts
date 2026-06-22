import { generateKeyPairSync } from "node:crypto";
import { jest } from "@jest/globals";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { RedisService } from "../redis/redis.service.js";
import { AuthVerificationService } from "./auth-verification.service.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

describe("AuthVerificationService", () => {
  let authVerificationService: AuthVerificationService;
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
      providers: [AuthVerificationService, { provide: RedisService, useValue: redisService }],
    }).compile();

    authVerificationService = moduleRef.get(AuthVerificationService);
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

  it("returns valid for a non-revoked token", async () => {
    const token = await signToken();
    await expect(authVerificationService.verifyToken(token)).resolves.toEqual({
      valid: true,
      userId: "user-1",
      role: "player",
      displayName: "player1",
      jti: "jti-1",
    });
  });

  it("returns invalid for malformed tokens", async () => {
    await expect(authVerificationService.verifyToken("bad-token")).resolves.toEqual({
      valid: false,
      reason: "INVALID",
    });
  });

  it("returns expired for expired tokens", async () => {
    const token = await signToken({ expiresIn: -1 });
    await expect(authVerificationService.verifyToken(token)).resolves.toEqual({
      valid: false,
      reason: "EXPIRED",
    });
  });

  it("returns revoked for blacklisted tokens", async () => {
    redisService.isAccessTokenRevoked.mockResolvedValue(true);
    const token = await signToken();
    await expect(authVerificationService.verifyToken(token)).resolves.toEqual({
      valid: false,
      reason: "REVOKED",
    });
  });
});
