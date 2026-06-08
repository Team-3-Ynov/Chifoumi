import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";

export type AccessTokenPayload = {
  sub: string;
  role: string;
  jti: string;
};

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(JWT_CONFIG) private readonly jwtConfig: JwtConfig,
  ) {}

  async issueAccessToken(input: {
    userId: string;
    role: string;
  }): Promise<{ accessToken: string }> {
    const jti = uuidv4();
    const accessToken = await this.jwtService.signAsync(
      { sub: input.userId, role: input.role, jti },
      {
        algorithm: "RS256",
        expiresIn: this.jwtConfig.accessTtlSeconds,
      },
    );
    return { accessToken };
  }

  issueRefreshToken(): { refreshToken: string; refreshTokenHash: string } {
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
    return { refreshToken, refreshTokenHash };
  }

  getRefreshExpiresAt(): Date {
    return new Date(Date.now() + this.jwtConfig.refreshTtlSeconds * 1000);
  }
}
