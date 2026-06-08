import { jest } from "@jest/globals";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

describe("AuthService", () => {
  const prisma = {
    refreshToken: {
      create: jest.fn<PrismaService["refreshToken"]["create"]>(),
      updateMany: jest.fn<PrismaService["refreshToken"]["updateMany"]>(),
    },
  };
  const usersService = {
    findByEmail: jest.fn<UsersService["findByEmail"]>(),
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
    getRefreshExpiresAt: jest.fn<TokenService["getRefreshExpiresAt"]>(),
  };
  const redisService = {
    revokeAccessToken: jest.fn<RedisService["revokeAccessToken"]>(),
  };
  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: TokenService, useValue: tokenService },
        { provide: RedisService, useValue: redisService },
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
