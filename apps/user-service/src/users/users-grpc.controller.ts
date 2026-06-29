import type {
  CurrentUserProfileResponse,
  ListLeaderboardResponse,
  ListUsersResponse,
  PublicUserProfileResponse,
  UserRecordResponse,
  VerifyPasswordResponse,
} from "@chifoumi/proto";
import { status as GrpcStatus } from "@grpc/grpc-js";
import { Controller, Inject } from "@nestjs/common";
import { GrpcMethod, RpcException } from "@nestjs/microservices";
import { UserService } from "./users.service.js";
import type {
  AdminUsersPage,
  CurrentUserProfile,
  PublicUserProfile,
  UserRecord,
} from "./users.types.js";

@Controller()
export class UsersGrpcController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @GrpcMethod("Users", "FindByEmail")
  async findByEmail(data: { email: string }): Promise<UserRecordResponse> {
    const user = await this.userService.findByEmail(data.email);
    return user ? this.toUserRecordResponse(user) : { found: false };
  }

  @GrpcMethod("Users", "FindById")
  async findById(data: { userId: string }): Promise<UserRecordResponse> {
    const user = await this.userService.findById(data.userId);
    return user ? this.toUserRecordResponse(user) : { found: false };
  }

  @GrpcMethod("Users", "CreateUser")
  async createUser(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecordResponse> {
    try {
      const user = await this.userService.createUser({
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
      });
      return this.toUserRecordResponse(user);
    } catch (error) {
      if (this.userService.isUniqueConstraintError(error)) {
        throw new RpcException({ code: GrpcStatus.ALREADY_EXISTS, message: "USER_EXISTS" });
      }
      throw error;
    }
  }

  @GrpcMethod("Users", "VerifyPassword")
  async verifyPassword(data: {
    email: string;
    plaintextPassword: string;
  }): Promise<VerifyPasswordResponse> {
    const result = await this.userService.verifyPassword(data.email, data.plaintextPassword);
    if (!result) {
      return { valid: false, userId: "", displayName: "", role: "" };
    }
    return result;
  }

  @GrpcMethod("Users", "UpdatePassword")
  async updatePassword(data: {
    userId: string;
    passwordHash: string;
  }): Promise<Record<string, never>> {
    try {
      await this.userService.updatePassword(data.userId, data.passwordHash);
      return {};
    } catch (error) {
      if (this.userService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  @GrpcMethod("Users", "GetRating")
  async getRating(data: { userId: string }) {
    try {
      const rating = await this.userService.getRating(data.userId);
      return {
        rating: rating.rating,
        gamesPlayed: rating.gamesPlayed,
      };
    } catch (error) {
      if (this.userService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  @GrpcMethod("Users", "GetCurrentProfile")
  async getCurrentProfile(data: { userId: string }): Promise<CurrentUserProfileResponse> {
    try {
      return this.toCurrentUserProfileResponse(
        await this.userService.getCurrentProfile(data.userId),
      );
    } catch (error) {
      if (this.userService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  @GrpcMethod("Users", "GetPublicProfile")
  async getPublicProfile(data: { userId: string }): Promise<PublicUserProfileResponse> {
    try {
      return this.toPublicUserProfileResponse(await this.userService.getPublicProfile(data.userId));
    } catch (error) {
      if (this.userService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  @GrpcMethod("Users", "ListUsers")
  async listUsers(data: { page: number; limit: number }): Promise<ListUsersResponse> {
    return this.toListUsersResponse(await this.userService.listUsers(data.page, data.limit));
  }

  @GrpcMethod("Users", "ListLeaderboard")
  async listLeaderboard(data: {
    limit: number;
    leagueName?: string;
  }): Promise<ListLeaderboardResponse> {
    return this.userService.listLeaderboard(data.limit, data.leagueName || undefined);
  }

  @GrpcMethod("Users", "GetCompetitionStats")
  async getCompetitionStats(data: { userId: string }) {
    try {
      return await this.userService.getCompetitionStats(data.userId);
    } catch (error) {
      if (this.userService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }

  private toUserRecordResponse(user: UserRecord): UserRecordResponse {
    return {
      found: true,
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private toCurrentUserProfileResponse(profile: CurrentUserProfile): CurrentUserProfileResponse {
    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  private toPublicUserProfileResponse(profile: PublicUserProfile): PublicUserProfileResponse {
    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  private toListUsersResponse(page: AdminUsersPage): ListUsersResponse {
    return {
      ...page,
      items: page.items.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }
}
