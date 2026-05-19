import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JwtModule } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { JWT_CONFIG, type JwtConfig } from "../config/jwt.config.js";
import { TokenService } from "./token.service.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../");

const jwtConfig: JwtConfig = {
  privateKey: readFileSync(resolve(repoRoot, "infra/keys/jwt-private.pem"), "utf8"),
  publicKey: readFileSync(resolve(repoRoot, "infra/keys/jwt-public.pem"), "utf8"),
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
};

describe("TokenService", () => {
  let tokenService: TokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          privateKey: jwtConfig.privateKey,
          publicKey: jwtConfig.publicKey,
          signOptions: { algorithm: "RS256" },
        }),
      ],
      providers: [TokenService, { provide: JWT_CONFIG, useValue: jwtConfig }],
    }).compile();

    tokenService = moduleRef.get(TokenService);
  });

  it("issues access jwt with sub, role, jti and 900s lifetime", async () => {
    const { accessToken } = await tokenService.issueAccessToken({
      userId: "11111111-1111-1111-1111-111111111111",
      role: "player",
    });
    const parts = accessToken.split(".");
    expect(parts).toHaveLength(3);
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as {
      sub: string;
      role: string;
      jti: string;
      exp: number;
      iat: number;
    };
    expect(payload.sub).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.role).toBe("player");
    expect(payload.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(payload.exp - payload.iat).toBe(900);
  });

  it("issues opaque refresh token and hash", () => {
    const { refreshToken, refreshTokenHash } = tokenService.issueRefreshToken();
    expect(refreshToken.length).toBeGreaterThan(20);
    expect(refreshToken).not.toBe(refreshTokenHash);
    expect(refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
