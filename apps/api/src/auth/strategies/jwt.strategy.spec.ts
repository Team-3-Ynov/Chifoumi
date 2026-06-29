import { generateKeyPairSync } from "node:crypto";
import { jest } from "@jest/globals";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { RedisService } from "../../redis/redis.service.js";
import type { UserService } from "../../user-service/user.service.js";
import { JwtStrategy } from "./jwt.strategy.js";

describe("JwtStrategy", () => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const usersService = {
    findById: jest.fn<UserService["findById"]>(),
    toSafeUser: jest.fn<UserService["toSafeUser"]>(),
  };
  const redisService = {
    isAccessTokenRevoked: jest.fn<RedisService["isAccessTokenRevoked"]>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns service unavailable when Redis revocation check fails", async () => {
    redisService.isAccessTokenRevoked.mockRejectedValue(new Error("redis down"));
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      usersService as unknown as UserService,
      redisService as unknown as RedisService,
    );

    await expect(
      strategy.validate({
        sub: "user-1",
        role: "player",
        jti: "jti-1",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects revoked access tokens", async () => {
    redisService.isAccessTokenRevoked.mockResolvedValue(true);
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      usersService as unknown as UserService,
      redisService as unknown as RedisService,
    );

    await expect(
      strategy.validate({
        sub: "user-1",
        role: "player",
        jti: "jti-1",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
