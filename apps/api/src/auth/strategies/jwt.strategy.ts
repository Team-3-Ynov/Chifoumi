import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JWT_CONFIG, type JwtConfig } from "../../config/jwt.config.js";
import { UsersService } from "../../users/users.service.js";

export type JwtPayload = {
  sub: string;
  role: string;
  jti: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(JWT_CONFIG) jwtConfig: JwtConfig,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["RS256"],
      secretOrKey: jwtConfig.publicKey,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.usersService.toSafeUser(user);
  }
}
