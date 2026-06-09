import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { RedisService } from "../redis/redis.service.js";
import {
  WS_AUTH_INVALID_TOKEN_CODE,
  WS_AUTH_TOKEN_REVOKED_CODE,
  WsAuthError,
} from "./ws-auth.error.js";

export type WsAuthPayload = {
  sub: string;
  role: string;
  jti: string;
  displayName: string;
  exp: number;
};

export type WsAuthResult = {
  userId: string;
  displayName: string;
  jti: string;
};

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async verifyToken(token: string | undefined): Promise<WsAuthResult> {
    if (!token || token.trim().length === 0) {
      throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
    }

    let payload: WsAuthPayload;
    try {
      payload = await this.jwtService.verifyAsync<WsAuthPayload>(token);
    } catch {
      throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
    }

    if (!payload.sub || !payload.jti || !payload.displayName) {
      throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
    }

    let revoked: boolean;
    try {
      revoked = await this.redisService.isAccessTokenRevoked(payload.jti);
    } catch {
      throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
    }

    if (revoked) {
      throw new WsAuthError("TOKEN_REVOKED", WS_AUTH_TOKEN_REVOKED_CODE);
    }

    return {
      userId: payload.sub,
      displayName: payload.displayName,
      jti: payload.jti,
    };
  }
}
