import { jest } from "@jest/globals";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

describe("AuthService", () => {
  const prisma = {
    refreshToken: {
      create: jest.fn<PrismaService["refreshToken"]["create"]>(),
      findFirst: jest.fn<PrismaService["refreshToken"]["findFirst"]>(),
      update: jest.fn<PrismaService["refreshToken"]["update"]>(),
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

  it("refresh rotates tokens for a valid refresh token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findFirst"]>>);
    prisma.refreshToken.update.mockResolvedValue(
      {} as Awaited<ReturnType<PrismaService["refreshToken"]["update"]>>,
    );
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

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "rt1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.tokens).toEqual({ access: "new-access", refresh: "new-refresh" });
  });

  it("refresh throws UnauthorizedException for unknown token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("missing");
    prisma.refreshToken.findFirst.mockResolvedValue(null);

    await expect(authService.refresh("unknown-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("refresh throws UnauthorizedException for expired token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2020-01-01"),
      revokedAt: null,
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findFirst"]>>);

    await expect(authService.refresh("expired-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("refresh revokes all user tokens on reuse of a revoked token", async () => {
    tokenService.hashRefreshToken.mockReturnValue("hashrefresh");
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: "rt1",
      userId: "u1",
      tokenHash: "hashrefresh",
      expiresAt: new Date("2030-01-01"),
      revokedAt: new Date("2029-01-01"),
    } as Awaited<ReturnType<PrismaService["refreshToken"]["findFirst"]>>);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(authService.refresh("reused-token")).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
