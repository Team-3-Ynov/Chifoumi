import { Prisma, type User, UserRole } from "@chifoumi/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { PublicProfileDto } from "./dto/public-profile.dto.js";

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

  async getPublicProfile(userId: string): Promise<PublicProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { eloRating: true },
    });

    if (!user) {
      throw new NotFoundException({ error: "USER_NOT_FOUND" });
    }

    const gamesPlayed = user.eloRating?.gamesPlayed ?? 0;
    const wins = gamesPlayed === 0 ? 0 : await this.countWins(userId);

    return {
      id: user.id,
      displayName: user.displayName,
      rating: user.eloRating?.rating ?? 1000,
      gamesPlayed,
      winRate: this.calculateWinRate(wins, gamesPlayed),
      createdAt: user.createdAt,
    };
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

  private calculateWinRate(wins: number, gamesPlayed: number): number {
    if (gamesPlayed === 0) {
      return 0;
    }
    return Math.round((wins / gamesPlayed) * 100) / 100;
  }

  private async countWins(userId: string): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ wins: number | bigint }>>`
        SELECT COUNT(*)::int AS wins
        FROM matches
        WHERE winner_id = ${userId}::uuid
      `;
      return Number(rows[0]?.wins ?? 0);
    } catch (error) {
      if (this.isUndefinedTableError(error)) {
        return 0;
      }
      throw error;
    }
  }

  private isUndefinedTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010" &&
      typeof error.meta?.code === "string" &&
      error.meta.code === "42P01"
    );
  }
}
