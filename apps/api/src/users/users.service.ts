import { Prisma, type User, UserRole } from "@chifoumi/db";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          role: UserRole.player,
        },
      });
      await tx.eloRating.create({
        data: { userId: user.id },
      });
      return user;
    });
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role === UserRole.admin ? "admin" : "player",
    };
  }

  isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
