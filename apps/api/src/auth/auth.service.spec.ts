import { jest } from "@jest/globals";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import { RedisService } from "../redis/redis.service.js";
import { UsersService } from "../users/users.service.js";
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
  };
  const usersService = {
    findByEmail: jest.fn<UsersService["findByEmail"]>(),
    findById: jest.fn<UsersService["findById"]>(),
    createUser: jest.fn<UsersService["createUser"]>(),
    toSafeUser: jest.fn<UsersService["toSafeUser"]>(),
    isUniqueConstraintError: jest.fn<UsersService["isUniqueConstraintError"]>(),
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
  };
  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisService.get.mockResolvedValue(null);
    redisService.setex.mockResolvedValue();
    redisService.setnx.mockResolvedValue(true);
    redisService.del.mockResolvedValue();
    notificationsQueue.enqueueWelcomeMail.mockResolvedValue(undefined);

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: unknown) =>
      (callback as (tx: never) => Promise<unknown>)({
        refreshToken: {
          updateMany: prisma.refreshToken.updateMany,
          create: prisma.refreshToken.create,
        },
      } as never),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
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
    } as Awaited<ReturnType<UsersService["createUser"]>>);
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
    } as Awaited<ReturnType<UsersService["createUser"]>>);
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
    usersService.findByEmail.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
    } as Awaited<ReturnType<UsersService["findByEmail"]>>);
    passwordService.verify.mockResolvedValue(false);

    await expect(authService.login({ email: "a@b.com", password: "wrong" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
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
    } as Awaited<ReturnType<UsersService["findById"]>>);
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
    } as Awaited<ReturnType<UsersService["findById"]>>);

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
    } as Awaited<ReturnType<UsersService["findById"]>>);
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
