import { status as GrpcStatus } from "@grpc/grpc-js";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { of, throwError } from "rxjs";
import { AuthService } from "./auth.service.js";

describe("AuthService gRPC client", () => {
  const grpcAuth = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    verifyToken: jest.fn(),
  };
  const client = {
    getService: jest.fn(() => grpcAuth),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(client as unknown as ClientGrpc);
    service.onModuleInit();
  });

  it("maps register auth results from auth-service", async () => {
    grpcAuth.register.mockReturnValue(
      of({
        user: {
          id: "user-1",
          email: "player@example.com",
          displayName: "player",
          role: "player",
        },
        tokens: { access: "access", refresh: "refresh" },
      }),
    );

    await expect(
      service.register({
        email: "player@example.com",
        password: "password1234",
        displayName: "player",
      }),
    ).resolves.toEqual({
      user: {
        id: "user-1",
        email: "player@example.com",
        displayName: "player",
        role: "player",
      },
      tokens: { access: "access", refresh: "refresh" },
    });
  });

  it("maps gRPC conflicts to HTTP conflicts", async () => {
    grpcAuth.register.mockReturnValue(throwError(() => ({ code: GrpcStatus.ALREADY_EXISTS })));

    await expect(
      service.register({
        email: "player@example.com",
        password: "password1234",
        displayName: "player",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps unauthenticated gRPC failures to UnauthorizedException", async () => {
    grpcAuth.login.mockReturnValue(throwError(() => ({ code: GrpcStatus.UNAUTHENTICATED })));

    await expect(
      service.login({ email: "player@example.com", password: "bad-password" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("maps unexpected gRPC failures to service unavailable", async () => {
    grpcAuth.refresh.mockReturnValue(throwError(() => new Error("down")));

    await expect(service.refresh("refresh-token")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("normalizes invalid token verification responses", async () => {
    grpcAuth.verifyToken.mockReturnValue(of({ valid: false, reason: "REVOKED" }));

    await expect(service.verifyToken("access-token")).resolves.toEqual({
      valid: false,
      reason: "REVOKED",
    });
  });
});
