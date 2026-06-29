import type { VerifyTokenResponse } from "@chifoumi/proto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { JwtService, TokenExpiredError } from "@nestjs/jwt";
import type { AccessTokenPayload } from "../auth/token.service.js";
import { RedisService } from "../redis/redis.service.js";
import { UserService } from "../user-service/user.service.js";

@Injectable()
export class AuthVerificationService {
  private readonly logger = new Logger(AuthVerificationService.name);

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(UserService) private readonly userService: UserService,
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
    } catch (error) {
      this.logger.error("Redis blacklist check failed during token verification", error);
      return { valid: false, reason: "UNAVAILABLE" };
    }

    if (revoked) {
      return { valid: false, reason: "REVOKED" };
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      return { valid: false, reason: "INVALID" };
    }

    return {
      valid: true,
      userId: payload.sub,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      jti: payload.jti,
    };
  }

  async verifySession(jti: string, userId: string): Promise<VerifyTokenResponse> {
    let revoked: boolean;
    try {
      revoked = await this.redisService.isAccessTokenRevoked(jti);
    } catch (error) {
      this.logger.error("Redis blacklist check failed during session verification", error);
      return { valid: false, reason: "UNAVAILABLE" };
    }

    if (revoked) {
      return { valid: false, reason: "REVOKED" };
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      return { valid: false, reason: "INVALID" };
    }

    return {
      valid: true,
      userId,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      jti,
    };
  }
}
