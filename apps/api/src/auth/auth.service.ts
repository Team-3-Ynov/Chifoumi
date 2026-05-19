import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { type SafeUser, UsersService } from "../users/users.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

export type AuthTokens = { access: string; refresh: string };
export type AuthResult = { user: SafeUser; tokens: AuthTokens };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("Unable to complete registration");
    }

    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const user = await this.usersService.createUser({
        email: input.email.toLowerCase(),
        passwordHash,
        displayName: input.displayName,
      });
      return this.issueTokensForUser(user.id, user);
    } catch (error) {
      if (this.usersService.isUniqueConstraintError(error)) {
        throw new ConflictException("Unable to complete registration");
      }
      throw error;
    }
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(input.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await this.passwordService.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueTokensForUser(user.id, user);
  }

  private async issueTokensForUser(
    userId: string,
    user: Parameters<UsersService["toSafeUser"]>[0],
  ): Promise<AuthResult> {
    const safeUser = this.usersService.toSafeUser(user);
    const { accessToken } = await this.tokenService.issueAccessToken({
      userId,
      role: safeUser.role,
    });
    const { refreshToken, refreshTokenHash } = this.tokenService.issueRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiresAt: this.tokenService.getRefreshExpiresAt(),
      },
    });
    return {
      user: safeUser,
      tokens: { access: accessToken, refresh: refreshToken },
    };
  }
}
