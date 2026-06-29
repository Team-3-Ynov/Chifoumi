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
      passReqToCallback: true,
      ignoreExpiration: false,
      algorithms: ["RS256"],
      secretOrKey: jwtConfig.publicKey,
    });
  }

  async validate(req: { headers?: { authorization?: string } }, payload: JwtPayload) {
    const token = this.extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedException();
    }

    let result: Awaited<ReturnType<AuthService["verifyToken"]>>;
    try {
      result = await this.authService.verifyToken(token);
    } catch {
      throw new ServiceUnavailableException("Authentication revocation store unavailable");
    }

    if (!result.valid || !result.userId || !result.role || !result.displayName) {
      throw new UnauthorizedException();
    }

    if (result.userId !== payload.sub || result.jti !== payload.jti) {
      throw new UnauthorizedException();
    }

    return {
      id: result.userId,
      email: "",
      displayName: result.displayName,
      role: result.role,
      tokenJti: payload.jti,
      tokenExpiresAt: new Date(payload.exp * 1000),
    };
  }

  private extractBearerToken(req: { headers?: { authorization?: string } }): string | null {
    const authorization = req.headers?.authorization;
    if (!authorization) {
      return null;
    }
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      return null;
    }
    return token;
  }
}
