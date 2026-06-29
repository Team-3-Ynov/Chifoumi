import { generateKeyPairSync } from "node:crypto";
import { jest } from "@jest/globals";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { AuthService } from "../auth.service.js";
import { JwtStrategy } from "./jwt.strategy.js";

describe("JwtStrategy", () => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const authService = {
    verifySession: jest.fn<AuthService["verifySession"]>(),
  };

  const payload = {
    sub: "user-1",
    role: "player",
    jti: "jti-1",
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns service unavailable when auth-service verification fails", async () => {
    authService.verifySession.mockRejectedValue(new Error("auth down"));
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      authService as unknown as AuthService,
    );

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects invalid access tokens", async () => {
    authService.verifySession.mockResolvedValue({ valid: false, reason: "REVOKED" });
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      authService as unknown as AuthService,
    );

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns user object for a valid session", async () => {
    authService.verifySession.mockResolvedValue({
      valid: true,
      userId: "user-1",
      role: "player",
      displayName: "Alice",
      email: "alice@example.com",
      jti: "jti-1",
    });
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      authService as unknown as AuthService,
    );

    const result = await strategy.validate(payload);

    expect(result).toMatchObject({
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice",
      role: "player",
      tokenJti: "jti-1",
    });
    expect(result.tokenExpiresAt).toBeInstanceOf(Date);
    expect(authService.verifySession).toHaveBeenCalledWith("jti-1", "user-1");
  });
});
