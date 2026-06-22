import type { VerifyTokenResponse } from "@chifoumi/proto";
import { Injectable } from "@nestjs/common";
import { JwtService, TokenExpiredError } from "@nestjs/jwt";
import type { AccessTokenPayload } from "../auth/token.service.js";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class AuthVerificationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    if (token.trim().length === 0) {
      return { valid: false, reason: "INVALID" };
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return { valid: false, reason: "EXPIRED" };
      }
      return { valid: false, reason: "INVALID" };
    }

    if (!payload.sub || !payload.jti || !payload.displayName) {
      return { valid: false, reason: "INVALID" };
    }

    let revoked: boolean;
    try {
      revoked = await this.redisService.isAccessTokenRevoked(payload.jti);
    } catch {
      return { valid: false, reason: "INVALID" };
    }

    if (revoked) {
      return { valid: false, reason: "REVOKED" };
    }

    return {
      valid: true,
      userId: payload.sub,
      role: payload.role,
      displayName: payload.displayName,
      jti: payload.jti,
    };
  }
}
