import type {
  AuthResultResponse,
  RefreshResponse,
  SafeUserMessage,
  UserRole,
  VerifyTokenResponse,
} from "@chifoumi/proto";
import { status as GrpcStatus } from "@grpc/grpc-js";
import {
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, timeout } from "rxjs";

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type AuthTokens = { access: string; refresh: string };
export type AuthResult = { user: SafeUser; tokens: AuthTokens };

type AuthGrpcService = {
  register(request: {
    email: string;
    password: string;
    displayName: string;
  }): import("rxjs").Observable<AuthResultResponse>;
  login(request: {
    email: string;
    password: string;
  }): import("rxjs").Observable<AuthResultResponse>;
  refresh(request: { refreshToken: string }): import("rxjs").Observable<RefreshResponse>;
  logout(request: {
    userId: string;
    jti: string;
    expiresAt: string;
  }): import("rxjs").Observable<Record<string, never>>;
  requestPasswordReset(request: {
    email: string;
  }): import("rxjs").Observable<Record<string, never>>;
  resetPassword(request: {
    token: string;
    newPassword: string;
  }): import("rxjs").Observable<Record<string, never>>;
  verifyToken(request: { token: string }): import("rxjs").Observable<{
    valid: boolean;
    userId?: string;
    role?: string;
    displayName?: string;
    reason?: string;
    jti?: string;
  }>;
};

export const AUTH_SERVICE_GRPC_CLIENT = "AUTH_SERVICE_GRPC_CLIENT";

const DEFAULT_TIMEOUT_MS = 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  private authService!: AuthGrpcService;

  constructor(@Inject(AUTH_SERVICE_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcService>("Auth");
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const response = await this.call(() => this.authService.register(input));
    return this.toAuthResult(response);
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const response = await this.call(() => this.authService.login(input));
    return this.toAuthResult(response);
  }

  async refresh(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    const response = await this.call(() => this.authService.refresh({ refreshToken }));
    if (!response.tokens) {
      throw new ServiceUnavailableException("Auth service returned an empty refresh response");
    }
    return { tokens: response.tokens };
  }

  async logout(input: { userId: string; jti: string; expiresAt: Date }): Promise<void> {
    await this.call(() =>
      this.authService.logout({
        userId: input.userId,
        jti: input.jti,
        expiresAt: input.expiresAt.toISOString(),
      }),
    );
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.call(() => this.authService.requestPasswordReset({ email }));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.call(() => this.authService.resetPassword({ token, newPassword }));
  }

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    const response = await this.call(() => this.authService.verifyToken({ token }));
    if (!response.valid) {
      const reason =
        response.reason === "REVOKED" ||
        response.reason === "EXPIRED" ||
        response.reason === "INVALID" ||
        response.reason === "UNAVAILABLE"
          ? response.reason
          : "INVALID";
      return { valid: false, reason };
    }
    return {
      valid: true,
      userId: response.userId,
      role: response.role,
      displayName: response.displayName,
      jti: response.jti,
    };
  }

  private async call<T>(factory: () => import("rxjs").Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(
        factory().pipe(
          timeout(Number(process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)),
        ),
      );
    } catch (error) {
      const code = this.getGrpcCode(error);
      if (code === GrpcStatus.ALREADY_EXISTS) {
        throw new ConflictException("Unable to complete registration");
      }
      if (code === GrpcStatus.UNAUTHENTICATED) {
        throw new UnauthorizedException();
      }
      throw new ServiceUnavailableException("Auth service unavailable");
    }
  }

  private toAuthResult(response: AuthResultResponse): AuthResult {
    if (!response.user || !response.tokens) {
      throw new ServiceUnavailableException("Auth service returned an incomplete auth result");
    }
    return {
      user: this.toSafeUser(response.user),
      tokens: response.tokens,
    };
  }

  private toSafeUser(user: SafeUserMessage): SafeUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  private getGrpcCode(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return undefined;
    }
    const code = (error as { code: unknown }).code;
    return typeof code === "number" ? code : undefined;
  }
}
