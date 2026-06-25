import { MatchStatus, Prisma } from "@chifoumi/db";
import { computeElo, type Outcome } from "@chifoumi/elo";
import { Injectable } from "@nestjs/common";
import type { MatchEndedPayload } from "../match-events/match-ended.types.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DEFAULT_RATING = 1000;
const DEFAULT_GAMES_PLAYED = 0;

export type MatchPersistenceResult = "created" | "already_exists";

@Injectable()
export class MatchPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async persistMatchEnded(payload: MatchEndedPayload): Promise<MatchPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.match.findUnique({
          where: { id: payload.matchId },
          select: { id: true },
        });
        if (existing) {
          return "already_exists";
        }

        const [playerA, playerB] = payload.players;
        const [ratingA, ratingB] = await Promise.all([
          this.findOrCreateRating(tx, playerA.userId),
          this.findOrCreateRating(tx, playerB.userId),
        ]);
        const elo = computeElo(
          ratingA.rating,
          ratingB.rating,
          this.toEloOutcome(payload),
          ratingA.gamesPlayed,
          ratingB.gamesPlayed,
        );

        await tx.match.create({
          data: {
            id: payload.matchId,
            playerAId: playerA.userId,
            playerBId: playerB.userId,
            winnerId: payload.winner,
            scoreA: payload.finalScore.a,
            scoreB: payload.finalScore.b,
            startedAt: new Date(payload.startedAt),
            endedAt: this.getEndedAt(payload),
            status: MatchStatus.ended,
          },
        });

        if (payload.tournamentMatchId) {
          await tx.tournamentMatch.update({
            where: { id: payload.tournamentMatchId },
            data: { matchId: payload.matchId },
          });
        }

        for (const round of payload.rounds) {
          await tx.round.upsert({
            where: {
              matchId_roundNumber: {
                matchId: payload.matchId,
                roundNumber: round.roundNumber,
              },
            },
            create: {
              matchId: payload.matchId,
              roundNumber: round.roundNumber,
              moveA: round.moveA,
              moveB: round.moveB,
              winner: round.winner,
              resolvedAt: new Date(round.resolvedAt),
            },
            update: {},
          });
        }

        await Promise.all([
          tx.eloRating.update({
            where: { userId: playerA.userId },
            data: {
              rating: elo.newRatingA,
              gamesPlayed: { increment: 1 },
            },
          }),
          tx.eloRating.update({
            where: { userId: playerB.userId },
            data: {
              rating: elo.newRatingB,
              gamesPlayed: { increment: 1 },
            },
          }),
          tx.eloHistory.createMany({
            data: [
              {
                userId: playerA.userId,
                matchId: payload.matchId,
                ratingBefore: ratingA.rating,
                ratingAfter: elo.newRatingA,
                delta: elo.deltaA,
              },
              {
                userId: playerB.userId,
                matchId: payload.matchId,
                ratingBefore: ratingB.rating,
                ratingAfter: elo.newRatingB,
                delta: elo.deltaB,
              },
            ],
          }),
        ]);

        return "created";
      });
    } catch (error) {
      if (this.isUniqueMatchConflict(error)) {
        return "already_exists";
      }
      throw error;
    }
  }

  private async findOrCreateRating(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ rating: number; gamesPlayed: number }> {
    return tx.eloRating.upsert({
      where: { userId },
      create: {
        userId,
        rating: DEFAULT_RATING,
        gamesPlayed: DEFAULT_GAMES_PLAYED,
      },
      update: {},
      select: {
        rating: true,
        gamesPlayed: true,
      },
    });
  }

  private toEloOutcome(payload: MatchEndedPayload): Outcome {
    if (payload.winner === payload.players[0].userId) {
      return "A";
    }
    if (payload.winner === payload.players[1].userId) {
      return "B";
    }
    return "DRAW";
  }

  private getEndedAt(payload: MatchEndedPayload): Date {
    const lastRound = payload.rounds.at(-1);
    return lastRound ? new Date(lastRound.resolvedAt) : new Date();
  }

  private isUniqueMatchConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
