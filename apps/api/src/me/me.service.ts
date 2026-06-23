import { getLeagueSummaryForRating, type LeagueSummary } from "@chifoumi/leagues";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export type MeProfile = {
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
export class MeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<MeProfile> {
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
      role: user.role === "admin" ? "admin" : "player",
      rating,
      gamesPlayed: user.eloRating?.gamesPlayed ?? 0,
      league: getLeagueSummaryForRating(rating),
      createdAt: user.createdAt,
    };
  }
}
