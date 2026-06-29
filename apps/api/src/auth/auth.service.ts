import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import { RedisService } from "../redis/redis.service.js";
import { type SafeUser, UserService } from "../user-service/user.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

export type AuthTokens = { access: string; refresh: string };
export type AuthResult = { user: SafeUser; tokens: AuthTokens };

const REFRESH_ROTATION_CACHE_SECONDS = 30;
const REFRESH_ROTATION_LOCK_SECONDS = 10;
const REFRESH_ROTATION_WAIT_ATTEMPTS = 10;
const REFRESH_ROTATION_WAIT_MS = 25;

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const DEFAULT_FRONTEND_URL = "http://localhost:5173";

@Injectable()
export class AuthService {
  constructor(
    @Inject(UserService) private readonly userService: UserService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(NotificationsQueueService)
    private readonly notificationsQueue: NotificationsQueueService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const existing = await this.userService.findByEmail(email);
    if (existing) {
      throw new ConflictException("Unable to complete registration");
    }

    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const user = await this.userService.createUser({
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
      if (this.userService.isUniqueConstraintError(error)) {
        throw new ConflictException("Unable to complete registration");
      }
      throw error;
    }
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.userService.findByEmail(input.email.toLowerCase());
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

    const user = await this.userService.findById(stored.userId);
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

    const safeUser = this.userService.toSafeUser(user);

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

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userService.findByEmail(normalizedEmail);
    if (!user) {
      return;
    }

    const { token, tokenHash } = this.tokenService.issuePasswordResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    // Invalidate any previously issued, still-unused reset token so only the
    // latest reset link remains valid for a given user.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const created = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = this.buildPasswordResetUrl(token);
    try {
      await this.notificationsQueue.enqueuePasswordResetMail({
        to: normalizedEmail,
        resetUrl,
      });
    } catch {
      // Compensation: if the mail job cannot be enqueued, drop the token we just
      // persisted so no unusable orphan reset token is left behind. The error is
      // swallowed to preserve the anti-enumeration contract (always responds 200).
      await this.prisma.passwordResetToken
        .delete({ where: { id: created.id } })
        .catch(() => undefined);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.tokenService.hashPasswordResetToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException();
    }
    if (stored.usedAt !== null) {
      throw new UnauthorizedException();
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    const newPasswordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: stored.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count === 0) {
        throw new UnauthorizedException();
      }

      // AC4: only refresh tokens are revoked here. Existing access JWTs are NOT
      // blacklisted on reset — they remain valid until their short (15 min)
      // expiry. This is an accepted trade-off documented for the reset flow.
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.userService.updatePassword(stored.userId, newPasswordHash);
  }

  async logout(input: { userId: string; jti: string; expiresAt: Date }): Promise<void> {
    const ttlSeconds = Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000);
    if (ttlSeconds <= 0) {
      throw new UnauthorizedException();
    }

    await this.redisService.revokeAccessToken(input.jti, ttlSeconds);
    await this.revokeAllRefreshTokens(input.userId);
  }

  private buildPasswordResetUrl(token: string): string {
    const frontendUrl = (process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL).replace(/\/+$/, "");
    return `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
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
    user: Parameters<UserService["toSafeUser"]>[0],
  ): Promise<AuthResult> {
    const safeUser = this.userService.toSafeUser(user);
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
