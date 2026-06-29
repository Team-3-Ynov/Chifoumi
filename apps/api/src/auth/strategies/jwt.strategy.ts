import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JWT_CONFIG, type JwtConfig } from "../../config/jwt.config.js";
import { RedisService } from "../../redis/redis.service.js";
import { UsersService } from "../../users/users.service.js";

export type JwtPayload = {
  sub: string;
  role: string;
  jti: string;
  exp: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(JWT_CONFIG) jwtConfig: JwtConfig,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["RS256"],
      secretOrKey: jwtConfig.publicKey,
    });
  }

  async validate(payload: JwtPayload) {
    let revoked: boolean;
    try {
      revoked = await this.redisService.isAccessTokenRevoked(payload.jti);
    } catch {
      throw new ServiceUnavailableException("Authentication revocation store unavailable");
    }

    if (revoked) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      ...this.usersService.toSafeUser(user),
      tokenJti: payload.jti,
      tokenExpiresAt: new Date(payload.exp * 1000),
    };
  }
}
