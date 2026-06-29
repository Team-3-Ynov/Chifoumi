import { status as GrpcStatus } from "@grpc/grpc-js";
import {
  ConflictException,
  Controller,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { GrpcMethod, RpcException } from "@nestjs/microservices";
import { AuthService } from "../auth/auth.service.js";
import { AuthVerificationService } from "./auth-verification.service.js";

@Controller()
export class AuthGrpcController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AuthVerificationService)
    private readonly authVerificationService: AuthVerificationService,
  ) {}

  @GrpcMethod("Auth", "Register")
  async register(data: { email: string; password: string; displayName: string }) {
    try {
      return await this.authService.register(data);
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod("Auth", "Login")
  async login(data: { email: string; password: string }) {
    try {
      return await this.authService.login(data);
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod("Auth", "Refresh")
  async refresh(data: { refreshToken: string }) {
    try {
      return await this.authService.refresh(data.refreshToken);
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod("Auth", "Logout")
  async logout(data: {
    userId: string;
    jti: string;
    expiresAt: string;
  }): Promise<Record<string, never>> {
    try {
      await this.authService.logout({
        userId: data.userId,
        jti: data.jti,
        expiresAt: new Date(data.expiresAt),
      });
      return {};
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod("Auth", "RequestPasswordReset")
  async requestPasswordReset(data: { email: string }): Promise<Record<string, never>> {
    try {
      await this.authService.requestPasswordReset(data.email);
      return {};
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod("Auth", "ResetPassword")
  async resetPassword(data: {
    token: string;
    newPassword: string;
  }): Promise<Record<string, never>> {
    try {
      await this.authService.resetPassword(data.token, data.newPassword);
      return {};
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod("Auth", "VerifyToken")
  async verifyToken(data: { token: string }) {
    const result = await this.authVerificationService.verifyToken(data.token);
    return {
      valid: result.valid,
      userId: result.userId ?? "",
      role: result.role ?? "",
      displayName: result.displayName ?? "",
      email: result.email ?? "",
      reason: result.reason ?? "",
      jti: result.jti ?? "",
    };
  }

  @GrpcMethod("Auth", "VerifySession")
  async verifySession(data: { jti: string; userId: string }) {
    const result = await this.authVerificationService.verifySession(data.jti, data.userId);
    return {
      valid: result.valid,
      userId: result.userId ?? "",
      role: result.role ?? "",
      displayName: result.displayName ?? "",
      email: result.email ?? "",
      reason: result.reason ?? "",
      jti: result.jti ?? "",
    };
  }

  private toRpcException(error: unknown): RpcException {
    if (error instanceof ConflictException) {
      return new RpcException({ code: GrpcStatus.ALREADY_EXISTS, message: "CONFLICT" });
    }
    if (error instanceof UnauthorizedException) {
      return new RpcException({ code: GrpcStatus.UNAUTHENTICATED, message: "UNAUTHORIZED" });
    }
    if (error instanceof ServiceUnavailableException) {
      return new RpcException({ code: GrpcStatus.UNAVAILABLE, message: "UNAVAILABLE" });
    }
    return new RpcException({ code: GrpcStatus.INTERNAL, message: "INTERNAL" });
  }
}
