import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export type MeProfile = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
  rating: number;
  gamesPlayed: number;
  createdAt: Date;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<MeProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { eloRating: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role === "admin" ? "admin" : "player",
      rating: user.eloRating?.rating ?? 1000,
      gamesPlayed: user.eloRating?.gamesPlayed ?? 0,
      createdAt: user.createdAt,
    };
  }
}
