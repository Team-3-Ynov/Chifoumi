import type { User } from "@chifoumi/db";
import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminUsersPage,
  type PublicUserProfile,
  type SafeUser,
  UserService,
} from "../user-service/user.service.js";

export type { AdminUserSummary, AdminUsersPage, SafeUser } from "../user-service/user.service.js";

@Injectable()
export class UsersService {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userService.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.userService.findById(id);
  }

  getRating(userId: string): Promise<{ rating: number; gamesPlayed: number }> {
    return this.userService.getRating(userId);
  }

  isNotFoundError(error: unknown): boolean {
    return this.userService.isNotFoundError(error);
  }

  getPublicProfile(userId: string): Promise<PublicUserProfile> {
    return this.userService.getPublicProfile(userId);
  }

  listUsers(page: number, limit: number): Promise<AdminUsersPage> {
    return this.userService.listUsers(page, limit);
  }

  createUser(input: { email: string; passwordHash: string; displayName: string }): Promise<User> {
    return this.userService.createUser(input);
  }

  toSafeUser(user: User): SafeUser {
    return this.userService.toSafeUser(user);
  }

  isUniqueConstraintError(error: unknown): boolean {
    return this.userService.isUniqueConstraintError(error);
  }
}
