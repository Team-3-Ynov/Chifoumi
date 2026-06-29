import type { VerifyTokenResponse } from "@chifoumi/proto";
import { jest } from "@jest/globals";
import type { JwtService } from "@nestjs/jwt";
import { TokenExpiredError } from "@nestjs/jwt";
import type { AccessTokenPayload } from "../auth/token.service.js";
import type { RedisService } from "../redis/redis.service.js";
import type { UserRecord, UserService } from "../user-service/user.service.js";
import { AuthVerificationService } from "./auth-verification.service.js";

describe("AuthVerificationService", () => {
  const payload = {
    sub: "user-1",
    role: "player",
    jti: "token-1",
    displayName: "stale-name",
  };

  let jwtService: { verifyAsync: jest.Mock<() => Promise<AccessTokenPayload>> };
  let redisService: { isAccessTokenRevoked: jest.Mock<() => Promise<boolean>> };
  let userService: { findById: jest.Mock<() => Promise<UserRecord | null>> };
  let service: AuthVerificationService;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn<() => Promise<AccessTokenPayload>>() };
    redisService = { isAccessTokenRevoked: jest.fn<() => Promise<boolean>>() };
    userService = { findById: jest.fn<() => Promise<UserRecord | null>>() };
    service = new AuthVerificationService(
      jwtService as unknown as JwtService,
      redisService as unknown as RedisService,
      userService as unknown as UserService,
    );
  });

  it("returns INVALID when the JWT user no longer exists", async () => {
    jwtService.verifyAsync.mockResolvedValue(payload);
    redisService.isAccessTokenRevoked.mockResolvedValue(false);
    userService.findById.mockResolvedValue(null);

    await expect(service.verifyToken("token")).resolves.toEqual({
      valid: false,
      reason: "INVALID",
    } satisfies VerifyTokenResponse);
  });

  it("returns current user data when the token is valid", async () => {
    jwtService.verifyAsync.mockResolvedValue(payload);
    redisService.isAccessTokenRevoked.mockResolvedValue(false);
    userService.findById.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      role: "admin",
      displayName: "current-name",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(service.verifyToken("token")).resolves.toEqual({
      valid: true,
      userId: "user-1",
      role: "admin",
      displayName: "current-name",
      email: "user@example.com",
      jti: "token-1",
    } satisfies VerifyTokenResponse);
  });

  it("returns EXPIRED for expired tokens", async () => {
    jwtService.verifyAsync.mockRejectedValue(new TokenExpiredError("expired", new Date()));

    await expect(service.verifyToken("token")).resolves.toEqual({
      valid: false,
      reason: "EXPIRED",
    } satisfies VerifyTokenResponse);
  });
});
