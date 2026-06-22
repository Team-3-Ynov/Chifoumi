import { Inject, Injectable } from "@nestjs/common";
import { API_AUTH_CLIENT, type ApiAuthClient } from "../grpc/api-auth.client.js";
import { AuthUnavailableError } from "../grpc/auth-unavailable.error.js";
import {
  WS_AUTH_INVALID_TOKEN_CODE,
  WS_AUTH_TOKEN_REVOKED_CODE,
  WS_AUTH_UNAVAILABLE_CODE,
  WsAuthError,
} from "./ws-auth.error.js";

export type WsAuthResult = {
  userId: string;
  displayName: string;
  jti: string;
};

@Injectable()
export class WsAuthService {
  constructor(@Inject(API_AUTH_CLIENT) private readonly apiAuthClient: ApiAuthClient) {}

  async verifyToken(token: string | undefined): Promise<WsAuthResult> {
    if (!token || token.trim().length === 0) {
      throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
    }

    try {
      const result = await this.apiAuthClient.verifyToken(token);

      if (result.valid) {
        if (!result.userId || !result.displayName || !result.jti) {
          throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
        }

        return {
          userId: result.userId,
          displayName: result.displayName,
          jti: result.jti,
        };
      }

      if (result.reason === "REVOKED") {
        throw new WsAuthError("TOKEN_REVOKED", WS_AUTH_TOKEN_REVOKED_CODE);
      }

      throw new WsAuthError("INVALID_TOKEN", WS_AUTH_INVALID_TOKEN_CODE);
    } catch (error) {
      if (error instanceof WsAuthError) {
        throw error;
      }

      if (error instanceof AuthUnavailableError) {
        throw new WsAuthError("AUTH_UNAVAILABLE", WS_AUTH_UNAVAILABLE_CODE);
      }

      throw new WsAuthError("AUTH_UNAVAILABLE", WS_AUTH_UNAVAILABLE_CODE);
    }
  }
}
