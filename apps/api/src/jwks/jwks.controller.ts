import { createPublicKey } from "node:crypto";
import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator.js";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";

@Public()
@Controller(".well-known")
export class JwksController {
  constructor(@Inject(JWT_CONFIG) private readonly jwtConfig: JwtConfig) {}

  @Get("jwks.json")
  getJwks(): { keys: Array<Record<string, string>> } {
    const keyObject = createPublicKey(this.jwtConfig.publicKey);
    const jwk = keyObject.export({ format: "jwk" }) as {
      n: string;
      e: string;
      kty: string;
    };
    return {
      keys: [
        {
          kty: jwk.kty,
          use: "sig",
          alg: "RS256",
          kid: "chifoumi-dev",
          n: jwk.n,
          e: jwk.e,
        },
      ],
    };
  }
}
