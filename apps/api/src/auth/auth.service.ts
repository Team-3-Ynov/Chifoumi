import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import { RedisService } from "../redis/redis.service.js";
import { type SafeUser, UsersService } from "../users/users.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

export type AuthTokens = { access: string; refresh: string };
export type AuthResult = { user: SafeUser; tokens: AuthTokens };

const REFRESH_ROTATION_CACHE_SECONDS = 30;
const REFRESH_ROTATION_LOCK_SECONDS = 10;
const REFRESH_ROTATION_WAIT_ATTEMPTS = 10;
const REFRESH_ROTATION_WAIT_MS = 25;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationsQueue: NotificationsQueueService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException("Unable to complete registration");
    }

    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const user = await this.usersService.createUser({
        email,
        passwordHash,
        displayName: input.displayName,
      });
      void this.notificationsQueue
        .enqueueWelcomeMail({
          to: email,
          displayName: input.displayName,
        })
        .catch(() => undefined);
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

  async refresh(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const cacheKey = this.refreshRotationCacheKey(tokenHash);
    const lockKey = this.refreshRotationLockKey(tokenHash);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException();
    }

    if (stored.revokedAt !== null) {
      await this.revokeAllRefreshTokens(stored.userId);
      throw new UnauthorizedException();
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const lockAcquired = await this.redisService.setnx(lockKey, REFRESH_ROTATION_LOCK_SECONDS);
    if (!lockAcquired) {
      const racedTokens = await this.waitForCachedRotation(cacheKey);
      if (racedTokens) {
        return { tokens: racedTokens };
      }
      throw new UnauthorizedException();
    }

    const safeUser = this.usersService.toSafeUser(user);

    try {
      const newRefreshToken = await this.prisma.$transaction(async (tx) => {
        const revoked = await tx.refreshToken.updateMany({
          where: {
            id: stored.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { revokedAt: new Date() },
        });

        if (revoked.count === 0) {
          throw new UnauthorizedException();
        }

        const issued = this.tokenService.issueRefreshToken();
        await tx.refreshToken.create({
          data: {
            userId: stored.userId,
            tokenHash: issued.refreshTokenHash,
            expiresAt: this.tokenService.getRefreshExpiresAt(),
          },
        });
        return issued.refreshToken;
      });

      const { accessToken } = await this.tokenService.issueAccessToken({
        userId: stored.userId,
        role: safeUser.role,
        displayName: safeUser.displayName,
      });
      const tokens = { access: accessToken, refresh: newRefreshToken };
      await this.cacheRotation(cacheKey, tokens);
      return { tokens };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        const racedTokens = await this.waitForCachedRotation(cacheKey);
        if (racedTokens) {
          return { tokens: racedTokens };
        }
      }
      throw error;
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  async logout(input: { userId: string; jti: string; expiresAt: Date }): Promise<void> {
    const ttlSeconds = Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000);
    if (ttlSeconds <= 0) {
      throw new UnauthorizedException();
    }

    await this.redisService.revokeAccessToken(input.jti, ttlSeconds);
    await this.revokeAllRefreshTokens(input.userId);
  }

  private refreshRotationCacheKey(tokenHash: string): string {
    return `refresh:rotation:${tokenHash}`;
  }

  private refreshRotationLockKey(tokenHash: string): string {
    return `refresh:lock:${tokenHash}`;
  }

  private async getCachedRotation(cacheKey: string): Promise<AuthTokens | null> {
    const cached = await this.redisService.get(cacheKey);
    if (!cached) {
      return null;
    }
    return JSON.parse(cached) as AuthTokens;
  }

  private async waitForCachedRotation(cacheKey: string): Promise<AuthTokens | null> {
    for (let attempt = 0; attempt < REFRESH_ROTATION_WAIT_ATTEMPTS; attempt += 1) {
      const cached = await this.getCachedRotation(cacheKey);
      if (cached) {
        return cached;
      }
      await new Promise((resolve) => setTimeout(resolve, REFRESH_ROTATION_WAIT_MS));
    }
    return null;
  }

  private async cacheRotation(cacheKey: string, tokens: AuthTokens): Promise<void> {
    await this.redisService.setex(cacheKey, REFRESH_ROTATION_CACHE_SECONDS, JSON.stringify(tokens));
  }

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async issueTokensForUser(
    userId: string,
    user: Parameters<UsersService["toSafeUser"]>[0],
  ): Promise<AuthResult> {
    const safeUser = this.usersService.toSafeUser(user);
    const { accessToken } = await this.tokenService.issueAccessToken({
      userId,
      role: safeUser.role,
      displayName: safeUser.displayName,
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
