import { Prisma, type User, UserRole } from "@chifoumi/db";
import { getLeagueSummaryForRating, type LeagueSummary } from "@chifoumi/leagues";
import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
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
  league: LeagueSummary;
  winRate: number;
  createdAt: Date;
};

export type CurrentUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
  rating: number;
  gamesPlayed: number;
  league: LeagueSummary;
  createdAt: Date;
};

@Injectable()
export class UserService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
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
      throw new UnauthorizedException();
    }

    const rating = user.eloRating?.rating ?? 1000;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role === UserRole.admin ? "admin" : "player",
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
        role: user.role === UserRole.admin ? "admin" : "player",
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

  isNotFoundError(error: unknown): boolean {
    return error instanceof NotFoundException;
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
