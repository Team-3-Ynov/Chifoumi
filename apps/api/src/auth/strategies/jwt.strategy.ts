import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JWT_CONFIG, type JwtConfig } from "../../config/jwt.config.js";
import { AuthService } from "../auth.service.js";

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
    @Inject(AuthService) private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["RS256"],
      secretOrKey: jwtConfig.publicKey,
    });
  }

  async validate(payload: JwtPayload) {
    let result: Awaited<ReturnType<AuthService["verifySession"]>>;
    try {
      result = await this.authService.verifySession(payload.jti, payload.sub);
    } catch {
      throw new ServiceUnavailableException("Authentication revocation store unavailable");
    }

    if (!result.valid || !result.userId || !result.role || !result.displayName) {
      throw new UnauthorizedException();
    }

    return {
      id: result.userId,
      email: result.email ?? "",
      displayName: result.displayName,
      role: result.role,
      tokenJti: payload.jti,
      tokenExpiresAt: new Date(payload.exp * 1000),
    };
  }
}
