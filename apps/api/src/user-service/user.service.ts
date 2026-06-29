import type {
  CompetitionStatsResponse,
  CurrentUserProfileResponse,
  ListLeaderboardResponse,
  ListUsersResponse,
  PublicUserProfileResponse,
  UserRecordResponse,
  UserRole,
} from "@chifoumi/proto";
import { status as GrpcStatus } from "@grpc/grpc-js";
import {
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, timeout } from "rxjs";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
};

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  gamesPlayed: number;
  createdAt: Date;
};

export type AdminUsersPage = {
  items: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
};

export type PublicUserProfile = {
  id: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  league: PublicUserProfileResponse["league"];
  winRate: number;
  createdAt: Date;
};

export type CurrentUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  gamesPlayed: number;
  league: CurrentUserProfileResponse["league"];
  createdAt: Date;
};

type UsersGrpcService = {
  findByEmail(request: { email: string }): import("rxjs").Observable<UserRecordResponse>;
  findById(request: { userId: string }): import("rxjs").Observable<UserRecordResponse>;
  createUser(request: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): import("rxjs").Observable<UserRecordResponse>;
  updatePassword(request: {
    userId: string;
    passwordHash: string;
  }): import("rxjs").Observable<Record<string, never>>;
  getRating(request: { userId: string }): import("rxjs").Observable<{
    rating: number;
    gamesPlayed: number;
  }>;
  getCurrentProfile(request: {
    userId: string;
  }): import("rxjs").Observable<CurrentUserProfileResponse>;
  getPublicProfile(request: {
    userId: string;
  }): import("rxjs").Observable<PublicUserProfileResponse>;
  listUsers(request: { page: number; limit: number }): import("rxjs").Observable<ListUsersResponse>;
  listLeaderboard(request: {
    limit: number;
    leagueName?: string;
  }): import("rxjs").Observable<ListLeaderboardResponse>;
  getCompetitionStats(request: {
    userId: string;
  }): import("rxjs").Observable<CompetitionStatsResponse>;
};

export const USER_SERVICE_GRPC_CLIENT = "USER_SERVICE_GRPC_CLIENT";

const DEFAULT_TIMEOUT_MS = 1000;

@Injectable()
export class UserService implements OnModuleInit {
  private usersService!: UsersGrpcService;

  constructor(@Inject(USER_SERVICE_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.usersService = this.client.getService<UsersGrpcService>("Users");
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const response = await this.call(() => this.usersService.findByEmail({ email }));
    return this.toUserRecordOrNull(response);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const response = await this.call(() => this.usersService.findById({ userId: id }));
    return this.toUserRecordOrNull(response);
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecord> {
    const response = await this.call(() => this.usersService.createUser(input));
    const user = this.toUserRecordOrNull(response);
    if (!user) {
      throw new ServiceUnavailableException("User service returned an empty user");
    }
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.call(() => this.usersService.updatePassword({ userId, passwordHash }));
  }

  async getRating(userId: string): Promise<{ rating: number; gamesPlayed: number }> {
    return this.call(() => this.usersService.getRating({ userId }));
  }

  async getCurrentProfile(userId: string): Promise<CurrentUserProfile> {
    try {
      const profile = await this.call(() => this.usersService.getCurrentProfile({ userId }));
      return {
        ...profile,
        createdAt: new Date(profile.createdAt),
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException({ error: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  async getPublicProfile(userId: string): Promise<PublicUserProfile> {
    try {
      const profile = await this.call(() => this.usersService.getPublicProfile({ userId }));
      return {
        ...profile,
        createdAt: new Date(profile.createdAt),
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException({ error: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  async listUsers(page: number, limit: number): Promise<AdminUsersPage> {
    const response = await this.call(() => this.usersService.listUsers({ page, limit }));
    return {
      ...response,
      items: response.items.map((user) => ({
        ...user,
        createdAt: new Date(user.createdAt),
      })),
    };
  }

  async listLeaderboard(limit: number, leagueName?: string): Promise<ListLeaderboardResponse> {
    return this.call(() => this.usersService.listLeaderboard({ limit, leagueName }));
  }

  async getCompetitionStats(userId: string): Promise<CompetitionStatsResponse> {
    return this.call(() => this.usersService.getCompetitionStats({ userId }));
  }

  toSafeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  isNotFoundError(error: unknown): boolean {
    return this.getGrpcCode(error) === GrpcStatus.NOT_FOUND || error instanceof NotFoundException;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return this.getGrpcCode(error) === GrpcStatus.ALREADY_EXISTS;
  }

  private async call<T>(factory: () => import("rxjs").Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(
        factory().pipe(
          timeout(Number(process.env.USER_SERVICE_GRPC_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)),
        ),
      );
    } catch (error) {
      if (this.isNotFoundError(error) || this.isUniqueConstraintError(error)) {
        throw error;
      }
      throw new ServiceUnavailableException("User service unavailable");
    }
  }

  private toUserRecordOrNull(response: UserRecordResponse): UserRecord | null {
    if (!response.found) {
      return null;
    }
    if (
      !response.id ||
      !response.email ||
      !response.passwordHash ||
      !response.displayName ||
      !response.role ||
      !response.createdAt
    ) {
      throw new ServiceUnavailableException("User service returned an incomplete user");
    }
    return {
      id: response.id,
      email: response.email,
      passwordHash: response.passwordHash,
      displayName: response.displayName,
      role: response.role,
      createdAt: new Date(response.createdAt),
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
