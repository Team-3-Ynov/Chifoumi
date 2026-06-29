import { Prisma, type User, UserRole } from "@chifoumi/db";
import { getLeagueSummaryForRating } from "@chifoumi/leagues";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  AdminUsersPage,
  CurrentUserProfile,
  PublicUserProfile,
  SafeUser,
  UserRecord,
} from "./users.types.js";

@Injectable()
export class UserService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.toUserRecord(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toUserRecord(user) : null;
  }

  async getRating(userId: string): Promise<{ rating: number; gamesPlayed: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { eloRating: true },
    });

    if (!user) {
      throw new NotFoundException({ error: "USER_NOT_FOUND" });
    }

    return {
      rating: user.eloRating?.rating ?? 1000,
      gamesPlayed: user.eloRating?.gamesPlayed ?? 0,
    };
  }

  async getCurrentProfile(userId: string): Promise<CurrentUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { eloRating: true },
    });

    if (!user) {
      throw new NotFoundException({ error: "USER_NOT_FOUND" });
    }

    const rating = user.eloRating?.rating ?? 1000;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: this.mapRole(user.role),
      rating,
      gamesPlayed: user.eloRating?.gamesPlayed ?? 0,
      league: getLeagueSummaryForRating(rating),
      createdAt: user.createdAt,
    };
  }

  async getPublicProfile(userId: string): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { eloRating: true },
    });

    if (!user) {
      throw new NotFoundException({ error: "USER_NOT_FOUND" });
    }

    const gamesPlayed = user.eloRating?.gamesPlayed ?? 0;
    const rating = user.eloRating?.rating ?? 1000;
    const wins = gamesPlayed === 0 ? 0 : await this.countWins(userId);

    return {
      id: user.id,
      displayName: user.displayName,
      rating,
      gamesPlayed,
      league: getLeagueSummaryForRating(rating),
      winRate: this.calculateWinRate(wins, gamesPlayed),
      createdAt: user.createdAt,
    };
  }

  async listUsers(page: number, limit: number): Promise<AdminUsersPage> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { eloRating: true },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: rows.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: this.mapRole(user.role),
        rating: user.eloRating?.rating ?? 1000,
        gamesPlayed: user.eloRating?.gamesPlayed ?? 0,
        createdAt: user.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecord> {
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          role: UserRole.player,
        },
      });
      await tx.eloRating.create({
        data: { userId: created.id },
      });
      return created;
    });
    return this.toUserRecord(user);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
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
    return (
      error instanceof NotFoundException ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
    );
  }

  isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private toUserRecord(user: User): UserRecord {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      role: this.mapRole(user.role),
      createdAt: user.createdAt,
    };
  }

  private mapRole(role: UserRole): "player" | "admin" {
    return role === UserRole.admin ? "admin" : "player";
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
