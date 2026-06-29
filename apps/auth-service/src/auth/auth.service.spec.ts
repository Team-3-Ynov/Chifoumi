import { jest } from "@jest/globals";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import { RedisService } from "../redis/redis.service.js";
import { UserService } from "../user-service/user.service.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

describe("AuthService", () => {
  const prisma = {
    $transaction: jest.fn<PrismaService["$transaction"]>(),
    refreshToken: {
      create: jest.fn<PrismaService["refreshToken"]["create"]>(),
      findUnique: jest.fn<PrismaService["refreshToken"]["findUnique"]>(),
      updateMany: jest.fn<PrismaService["refreshToken"]["updateMany"]>(),
    },
    passwordResetToken: {
      create: jest.fn<PrismaService["passwordResetToken"]["create"]>(),
      findUnique: jest.fn<PrismaService["passwordResetToken"]["findUnique"]>(),
      updateMany: jest.fn<PrismaService["passwordResetToken"]["updateMany"]>(),
      delete: jest.fn<PrismaService["passwordResetToken"]["delete"]>(),
    },
    user: {
      update: jest.fn<PrismaService["user"]["update"]>(),
    },
  };
  const usersService = {
    findByEmail: jest.fn<UserService["findByEmail"]>(),
    findById: jest.fn<UserService["findById"]>(),
    createUser: jest.fn<UserService["createUser"]>(),
    updatePassword: jest.fn<UserService["updatePassword"]>(),
    verifyPassword: jest.fn<UserService["verifyPassword"]>(),
    toSafeUser: jest.fn<UserService["toSafeUser"]>(),
    isUniqueConstraintError: jest.fn<UserService["isUniqueConstraintError"]>(),
  };
  const passwordService = {
    hash: jest.fn<PasswordService["hash"]>(),
    verify: jest.fn<PasswordService["verify"]>(),
  };
  const tokenService = {
    issueAccessToken: jest.fn<TokenService["issueAccessToken"]>(),
    issueRefreshToken: jest.fn<TokenService["issueRefreshToken"]>(),
    hashRefreshToken: jest.fn<TokenService["hashRefreshToken"]>(),
    getRefreshExpiresAt: jest.fn<TokenService["getRefreshExpiresAt"]>(),
    issuePasswordResetToken: jest.fn<TokenService["issuePasswordResetToken"]>(),
    hashPasswordResetToken: jest.fn<TokenService["hashPasswordResetToken"]>(),
  };
  const redisService = {
    revokeAccessToken: jest.fn<RedisService["revokeAccessToken"]>(),
    get: jest.fn<RedisService["get"]>(),
    setex: jest.fn<RedisService["setex"]>(),
    setnx: jest.fn<RedisService["setnx"]>(),
    del: jest.fn<RedisService["del"]>(),
  };
  const notificationsQueue = {
    enqueueWelcomeMail: jest.fn<NotificationsQueueService["enqueueWelcomeMail"]>(),
    enqueuePasswordResetMail: jest.fn<NotificationsQueueService["enqueuePasswordResetMail"]>(),
  };
  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisService.get.mockResolvedValue(null);
    redisService.setex.mockResolvedValue();
    redisService.setnx.mockResolvedValue(true);
    redisService.del.mockResolvedValue();
    notificationsQueue.enqueueWelcomeMail.mockResolvedValue(undefined);
    notificationsQueue.enqueuePasswordResetMail.mockResolvedValue(undefined);

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: unknown) =>
      (callback as (tx: never) => Promise<unknown>)({
        refreshToken: {
          updateMany: prisma.refreshToken.updateMany,
          create: prisma.refreshToken.create,
        },
        passwordResetToken: {
          updateMany: prisma.passwordResetToken.updateMany,
        },
        user: {
          update: prisma.user.update,
        },
      } as never),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: TokenService, useValue: tokenService },
        { provide: RedisService, useValue: redisService },
        { provide: NotificationsQueueService, useValue: notificationsQueue },
      ],
    }).compile();
    authService = moduleRef.get(AuthService);
  });

  it("register hashes password and returns tokens", async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue("hash");
    usersService.createUser.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    } as Awaited<ReturnType<UserService["createUser"]>>);
    usersService.toSafeUser.mockReturnValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    });
    tokenService.issueAccessToken.mockResolvedValue({ accessToken: "access" });
    tokenService.issueRefreshToken.mockReturnValue({
      refreshToken: "refresh",
      refreshTokenHash: "hashrefresh",
    });
    tokenService.getRefreshExpiresAt.mockReturnValue(new Date("2030-01-01"));
    prisma.refreshToken.create.mockResolvedValue(
      {} as Awaited<ReturnType<PrismaService["refreshToken"]["create"]>>,
    );

    const result = await authService.register({
      email: "a@b.com",
      password: "password1234",
      displayName: "alice",
    });

    expect(passwordService.hash).toHaveBeenCalledWith("password1234");
    expect(usersService.createUser).toHaveBeenCalledWith({
      email: "a@b.com",
      passwordHash: "hash",
      displayName: "alice",
    });
    expect(notificationsQueue.enqueueWelcomeMail).toHaveBeenCalledWith({
      to: "a@b.com",
      displayName: "alice",
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        tokenHash: "hashrefresh",
        expiresAt: new Date("2030-01-01"),
      },
    });
    expect(result.tokens.access).toBe("access");
    expect(result.tokens.refresh).toBe("refresh");
  });

  it("register still returns tokens when welcome mail enqueue fails", async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue("hash");
    usersService.createUser.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    } as Awaited<ReturnType<UserService["createUser"]>>);
    usersService.toSafeUser.mockReturnValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    });
    notificationsQueue.enqueueWelcomeMail.mockRejectedValue(new Error("queue unavailable"));
    tokenService.issueAccessToken.mockResolvedValue({ accessToken: "access" });
    tokenService.issueRefreshToken.mockReturnValue({
      refreshToken: "refresh",
      refreshTokenHash: "hashrefresh",
    });
    tokenService.getRefreshExpiresAt.mockReturnValue(new Date("2030-01-01"));
    prisma.refreshToken.create.mockResolvedValue(
      {} as Awaited<ReturnType<PrismaService["refreshToken"]["create"]>>,
    );

    const result = await authService.register({
      email: "a@b.com",
      password: "password1234",
      displayName: "alice",
    });

    expect(notificationsQueue.enqueueWelcomeMail).toHaveBeenCalledWith({
      to: "a@b.com",
      displayName: "alice",
    });
    expect(result.tokens).toEqual({ access: "access", refresh: "refresh" });
  });

  it("register throws ConflictException on duplicate without leaking field", async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue("hash");
    usersService.createUser.mockRejectedValue(new Error("dup"));
    usersService.isUniqueConstraintError.mockReturnValue(true);

    await expect(
      authService.register({
        email: "a@b.com",
        password: "password1234",
        displayName: "alice",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("login throws UnauthorizedException on bad password", async () => {
    usersService.verifyPassword.mockResolvedValue(null);

    await expect(authService.login({ email: "a@b.com", password: "wrong" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.verifyPassword).toHaveBeenCalledWith("a@b.com", "wrong");
  });

  it("refresh rotates tokens for a valid refresh token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findUnique"]>>);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    usersService.findById.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    } as Awaited<ReturnType<UserService["findById"]>>);
    usersService.toSafeUser.mockReturnValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    });
    tokenService.issueAccessToken.mockResolvedValue({ accessToken: "new-access" });
    tokenService.issueRefreshToken.mockReturnValue({
      refreshToken: "new-refresh",
      refreshTokenHash: "new-hash",
    });
    tokenService.getRefreshExpiresAt.mockReturnValue(new Date("2030-01-02"));
    prisma.refreshToken.create.mockResolvedValue(
      {} as Awaited<ReturnType<PrismaService["refreshToken"]["create"]>>,
    );

    const result = await authService.refresh("old-refresh-token");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: "rt1",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        tokenHash: "new-hash",
        expiresAt: new Date("2030-01-02"),
      },
    });
    expect(result.tokens).toEqual({ access: "new-access", refresh: "new-refresh" });
    expect(redisService.setnx).toHaveBeenCalledWith("refresh:lock:hashrefresh", 10);
    expect(redisService.del).toHaveBeenCalledWith("refresh:lock:hashrefresh");
  });

  it("refresh returns cached tokens for duplicate concurrent requests", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    redisService.setnx.mockResolvedValue(false);
    redisService.get.mockResolvedValue(
      JSON.stringify({ access: "cached-access", refresh: "cached-refresh" }),
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findUnique"]>>);
    usersService.findById.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    } as Awaited<ReturnType<UserService["findById"]>>);

    const result = await authService.refresh("old-refresh-token");

    expect(result.tokens).toEqual({ access: "cached-access", refresh: "cached-refresh" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refresh throws UnauthorizedException for unknown token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("missing");
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(authService.refresh("unknown-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("refresh throws UnauthorizedException for expired token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2020-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findUnique"]>>);

    await expect(authService.refresh("expired-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("refresh throws UnauthorizedException when user no longer exists", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findUnique"]>>);
    usersService.findById.mockResolvedValue(null);

    await expect(authService.refresh("valid-token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refresh revokes all user tokens on reuse of a revoked token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: new Date("2029-01-01"),
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findUnique"]>>);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(authService.refresh("reused-token")).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("refresh returns cached tokens when rotation loses a race", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    redisService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        JSON.stringify({ access: "cached-access", refresh: "cached-refresh" }),
      );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findUnique"]>>);
    usersService.findById.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayName: "alice",
      role: "player",
    } as Awaited<ReturnType<UserService["findById"]>>);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await authService.refresh("concurrent-token");

    expect(result.tokens).toEqual({ access: "cached-access", refresh: "cached-refresh" });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it("logout blacklists access token and revokes active refresh tokens", async () => {
    redisService.revokeAccessToken.mockResolvedValue();
    prisma.refreshToken.updateMany.mockResolvedValue({
      count: 1,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["updateMany"]>>);

    await authService.logout({
      userId: "u1",
      jti: "jti-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(redisService.revokeAccessToken).toHaveBeenCalledWith("jti-1", expect.any(Number));
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it("requestPasswordReset persists hashed token and enqueues mail when email is known", async () => {
    usersService.findByEmail.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
    } as Awaited<ReturnType<UserService["findByEmail"]>>);
    tokenService.issuePasswordResetToken.mockReturnValue({
      token: "raw-token",
      tokenHash: "hashed-token",
    });
    prisma.passwordResetToken.create.mockResolvedValue(
      {} as Awaited<ReturnType<PrismaService["passwordResetToken"]["create"]>>,
    );

    await authService.requestPasswordReset("A@B.com");

    expect(usersService.findByEmail).toHaveBeenCalledWith("a@b.com");
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const [updateOrder] = prisma.passwordResetToken.updateMany.mock.invocationCallOrder;
    const [createOrder] = prisma.passwordResetToken.create.mock.invocationCallOrder;
    expect(updateOrder).toBeDefined();
    expect(createOrder).toBeDefined();
    expect(updateOrder ?? 0).toBeLessThan(createOrder ?? 0);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        tokenHash: "hashed-token",
        expiresAt: expect.any(Date),
      },
    });
    expect(notificationsQueue.enqueuePasswordResetMail).toHaveBeenCalledWith({
      to: "a@b.com",
      resetUrl: expect.stringContaining("/reset-password?token=raw-token"),
    });
  });

  it("requestPasswordReset is silent when email is unknown (anti-enumeration)", async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await authService.requestPasswordReset("missing@example.com");

    expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(notificationsQueue.enqueuePasswordResetMail).not.toHaveBeenCalled();
    expect(tokenService.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it("requestPasswordReset deletes the persisted token when mail enqueue fails (no orphan)", async () => {
    usersService.findByEmail.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
    } as Awaited<ReturnType<UserService["findByEmail"]>>);
    tokenService.issuePasswordResetToken.mockReturnValue({
      token: "raw-token",
      tokenHash: "hashed-token",
    });
    prisma.passwordResetToken.create.mockResolvedValue({ id: "prt-new" } as Awaited<
      ReturnType<PrismaService["passwordResetToken"]["create"]>
    >);
    notificationsQueue.enqueuePasswordResetMail.mockRejectedValue(new Error("queue unavailable"));
    prisma.passwordResetToken.delete.mockResolvedValue(
      {} as Awaited<ReturnType<PrismaService["passwordResetToken"]["delete"]>>,
    );

    await expect(authService.requestPasswordReset("a@b.com")).resolves.toBeUndefined();

    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: "prt-new" } });
  });

  it("resetPassword updates password, marks token used and revokes refresh tokens", async () => {
    tokenService.hashPasswordResetToken.mockReturnValue("hashed-token");
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "prt1",
      userId: "u1",
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    } as Awaited<ReturnType<PrismaService["passwordResetToken"]["findUnique"]>>);
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    passwordService.hash.mockResolvedValue("new-hash");

    await authService.resetPassword("raw-token", "newPassword1234");

    expect(passwordService.hash).toHaveBeenCalledWith("newPassword1234");
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: "prt1",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(usersService.updatePassword).toHaveBeenCalledWith("u1", "new-hash");
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("resetPassword rejects unknown token", async () => {
    tokenService.hashPasswordResetToken.mockReturnValue("missing");
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(authService.resetPassword("nope", "newPassword1234")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it("resetPassword rejects expired token", async () => {
    tokenService.hashPasswordResetToken.mockReturnValue("hashed-token");
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "prt1",
      userId: "u1",
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    } as Awaited<ReturnType<PrismaService["passwordResetToken"]["findUnique"]>>);

    await expect(authService.resetPassword("expired", "newPassword1234")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it("resetPassword rejects already used token", async () => {
    tokenService.hashPasswordResetToken.mockReturnValue("hashed-token");
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "prt1",
      userId: "u1",
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(Date.now() - 1_000),
    } as Awaited<ReturnType<PrismaService["passwordResetToken"]["findUnique"]>>);

    await expect(authService.resetPassword("reused", "newPassword1234")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it("logout rejects already expired access tokens", async () => {
    await expect(
      authService.logout({
        userId: "u1",
        jti: "jti-1",
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redisService.revokeAccessToken).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
