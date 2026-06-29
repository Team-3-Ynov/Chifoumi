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
    verifyToken: jest.fn<AuthService["verifyToken"]>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns service unavailable when auth-service verification fails", async () => {
    authService.verifyToken.mockRejectedValue(new Error("auth down"));
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      authService as unknown as AuthService,
    );

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer token" } },
        {
          sub: "user-1",
          role: "player",
          jti: "jti-1",
          exp: Math.floor(Date.now() / 1000) + 60,
        },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects invalid access tokens", async () => {
    authService.verifyToken.mockResolvedValue({ valid: false, reason: "REVOKED" });
    const strategy = new JwtStrategy(
      { publicKey, privateKey: "unused", accessTtlSeconds: 900, refreshTtlSeconds: 604800 },
      authService as unknown as AuthService,
    );

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer token" } },
        {
          sub: "user-1",
          role: "player",
          jti: "jti-1",
          exp: Math.floor(Date.now() / 1000) + 60,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
