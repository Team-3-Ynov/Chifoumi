import { generateFirstRound, type PlayerId, seedPlayers } from "@chifoumi/bracket";
import { TournamentStatus } from "@chifoumi/db";
import { Inject, Injectable } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import { buildBracketStructure, defaultRatingForUser } from "./build-bracket-structure.js";
import type { GenerateBracketPayload, GenerateBracketResult } from "./generate-bracket.types.js";
import { GenerateBracketLockService } from "./generate-bracket-lock.service.js";

@Injectable()
export class GenerateBracketService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(GenerateBracketLockService)
    private readonly generateBracketLock: GenerateBracketLockService,
    @Inject(NotificationsQueueService)
    private readonly notificationsQueue: NotificationsQueueService,
  ) {}

  async processGenerateBracket(payload: GenerateBracketPayload): Promise<GenerateBracketResult> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: payload.tournamentId },
      include: {
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      throw new UnrecoverableError(`Tournament ${payload.tournamentId} not found`);
    }

    if (tournament.status !== TournamentStatus.in_progress) {
      throw new UnrecoverableError(
        `Tournament ${tournament.id} is not in progress (status=${tournament.status})`,
      );
    }

    const existingMatches = await this.prisma.tournamentMatch.count({
      where: { tournamentId: tournament.id },
    });
    if (existingMatches > 0) {
      await this.enqueueTournamentStartedNotifications(
        tournament.id,
        tournament.name,
        tournament.registrations,
      );
      return "already_generated";
    }

    const lockToken = await this.generateBracketLock.acquire(tournament.id);
    if (!lockToken) {
      throw new Error(`Generate-bracket lock not acquired for ${tournament.id}`);
    }

    try {
      const matchesAfterLock = await this.prisma.tournamentMatch.count({
        where: { tournamentId: tournament.id },
      });
      if (matchesAfterLock > 0) {
        await this.enqueueTournamentStartedNotifications(
          tournament.id,
          tournament.name,
          tournament.registrations,
        );
        return "already_generated";
      }

      if (tournament.registrations.length < 2) {
        throw new UnrecoverableError(`Tournament ${tournament.id} has fewer than 2 registrations`);
      }

      if (tournament.registrations.length > tournament.bracketSize) {
        throw new UnrecoverableError(
          `${tournament.registrations.length} registrations exceed bracket size ${tournament.bracketSize}`,
        );
      }

      const ratings = await this.prisma.eloRating.findMany({
        where: {
          userId: { in: tournament.registrations.map((registration) => registration.userId) },
        },
        select: { userId: true, rating: true },
      });
      const ratingByUserId = new Map(ratings.map((entry) => [entry.userId, entry.rating]));

      const players = tournament.registrations.map((registration) => ({
        id: registration.userId as PlayerId,
        rating: defaultRatingForUser(ratingByUserId.get(registration.userId)),
      }));
      const seededPlayers = seedPlayers(players);
      const firstRoundPairings = generateFirstRound(seededPlayers, tournament.bracketSize);
      const built = buildBracketStructure(
        seededPlayers,
        tournament.bracketSize,
        firstRoundPairings,
      );

      await this.prisma.$transaction(async (tx) => {
        for (const seededPlayer of seededPlayers) {
          await tx.tournamentRegistration.update({
            where: {
              tournamentId_userId: {
                tournamentId: tournament.id,
                userId: seededPlayer.id,
              },
            },
            data: { seed: seededPlayer.seed },
          });
        }

        await tx.tournamentMatch.createMany({
          data: built.matches.map((match) => ({
            id: match.id,
            tournamentId: tournament.id,
            round: match.round,
            positionIndex: match.positionIndex,
            slotAId: match.slotAId,
            slotBId: match.slotBId,
            winnerSlot: match.winnerSlot,
            nextMatchId: match.nextMatchId,
          })),
        });
      });

      await this.enqueueTournamentStartedNotifications(
        tournament.id,
        tournament.name,
        tournament.registrations,
      );

      return "generated";
    } finally {
      await this.generateBracketLock.release(tournament.id, lockToken);
    }
  }

  private async enqueueTournamentStartedNotifications(
    tournamentId: string,
    tournamentName: string,
    registrations: Array<{
      userId: string;
      user: { email: string; displayName: string };
    }>,
  ): Promise<void> {
    for (const registration of registrations) {
      await this.notificationsQueue.enqueueTournamentStartedMail({
        tournamentId,
        userId: registration.userId,
        to: registration.user.email,
        displayName: GenerateBracketService.sanitizeForTemplate(registration.user.displayName),
        tournamentName,
      });
    }
  }

  private static sanitizeForTemplate(displayName: string): string {
    return displayName.replace(/__[A-Z_]+__/g, "");
  }
}
