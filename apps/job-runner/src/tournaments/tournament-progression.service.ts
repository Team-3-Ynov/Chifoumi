import { TournamentStatus, WinnerSlot } from "@chifoumi/db";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import { resolveFeederTargetSlotUpdate } from "./resolve-feeder-target-slot.js";
import { TournamentMatchReadyService } from "./tournament-match-ready.service.js";
import type { TournamentProgressionResult } from "./tournament-progression.types.js";

type ProcessMatchEndedInput = {
  matchId: string;
  winnerId: string | null;
  tournamentMatchId?: string;
};

type TournamentMatchRecord = {
  id: string;
  tournamentId: string;
  round: number;
  positionIndex: number;
  matchId: string | null;
  slotAId: string | null;
  slotBId: string | null;
  nextMatchId: string | null;
  winnerSlot: WinnerSlot | null;
  tournament: {
    id: string;
    name: string;
    status: TournamentStatus;
  };
};

@Injectable()
export class TournamentProgressionService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NotificationsQueueService)
    private readonly notificationsQueue: NotificationsQueueService,
    @Inject(TournamentMatchReadyService)
    private readonly tournamentMatchReady: TournamentMatchReadyService,
  ) {}

  async processMatchEnded(input: ProcessMatchEndedInput): Promise<TournamentProgressionResult> {
    if (!input.winnerId) {
      return "no_winner";
    }

    const tournamentMatch = await this.findTournamentMatch(input);
    if (!tournamentMatch) {
      return "not_tournament_match";
    }

    if (tournamentMatch.winnerSlot !== null) {
      return "already_advanced";
    }

    const winnerSlot = this.resolveWinnerSlot(tournamentMatch, input.winnerId);
    if (!winnerSlot) {
      return "not_tournament_match";
    }

    if (!tournamentMatch.nextMatchId) {
      return this.completeTournament(tournamentMatch, winnerSlot, input.winnerId);
    }

    return this.advanceWinner(tournamentMatch, winnerSlot, input.winnerId);
  }

  private async findTournamentMatch(
    input: ProcessMatchEndedInput,
  ): Promise<TournamentMatchRecord | null> {
    const include = {
      tournament: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    } as const;

    if (input.tournamentMatchId) {
      const byId = await this.prisma.tournamentMatch.findUnique({
        where: { id: input.tournamentMatchId },
        include,
      });
      if (byId) {
        return byId;
      }
    }

    return this.prisma.tournamentMatch.findFirst({
      where: { matchId: input.matchId },
      include,
    });
  }

  private resolveWinnerSlot(
    tournamentMatch: Pick<TournamentMatchRecord, "slotAId" | "slotBId">,
    winnerId: string,
  ): WinnerSlot | null {
    if (tournamentMatch.slotAId === winnerId) {
      return WinnerSlot.a;
    }

    if (tournamentMatch.slotBId === winnerId) {
      return WinnerSlot.b;
    }

    return null;
  }

  private async completeTournament(
    tournamentMatch: TournamentMatchRecord,
    winnerSlot: WinnerSlot,
    winnerId: string,
  ): Promise<TournamentProgressionResult> {
    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.update({
        where: { id: tournamentMatch.id },
        data: { winnerSlot },
      });

      await tx.tournament.update({
        where: { id: tournamentMatch.tournamentId },
        data: {
          winnerId,
          status: TournamentStatus.completed,
          endedAt: new Date(),
        },
      });
    });

    await this.enqueueTournamentCompletedNotification(
      tournamentMatch.tournamentId,
      tournamentMatch.tournament.name,
      winnerId,
    );

    return "tournament_completed";
  }

  private async advanceWinner(
    tournamentMatch: TournamentMatchRecord,
    winnerSlot: WinnerSlot,
    winnerId: string,
  ): Promise<TournamentProgressionResult> {
    const readyMatch = await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.update({
        where: { id: tournamentMatch.id },
        data: { winnerSlot },
      });

      const parentMatch = await tx.tournamentMatch.findUnique({
        where: { id: tournamentMatch.nextMatchId ?? undefined },
      });

      if (!parentMatch) {
        throw new Error(`Next tournament match ${tournamentMatch.nextMatchId} not found`);
      }

      const slotUpdate = resolveFeederTargetSlotUpdate(
        { positionIndex: tournamentMatch.positionIndex },
        parentMatch,
        winnerId,
      );
      if (!slotUpdate) {
        return null;
      }

      const updatedParent = await tx.tournamentMatch.update({
        where: { id: parentMatch.id },
        data: slotUpdate,
      });

      const slotAId = updatedParent.slotAId;
      const slotBId = updatedParent.slotBId;

      if (!slotAId || !slotBId || updatedParent.matchId || updatedParent.winnerSlot) {
        return null;
      }

      return updatedParent.id;
    });

    if (readyMatch) {
      await this.notifyReadyMatch(readyMatch, tournamentMatch.tournament.name);
    }

    return "advanced";
  }

  private async notifyReadyMatch(tournamentMatchId: string, tournamentName: string): Promise<void> {
    const readyMatch = await this.prisma.tournamentMatch.findUnique({
      where: { id: tournamentMatchId },
      include: {
        slotA: { select: { id: true, displayName: true, email: true } },
        slotB: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (!readyMatch?.slotA || !readyMatch.slotB) {
      return;
    }

    await this.tournamentMatchReady.notifyPlayersMatchReady({
      tournamentMatchId: readyMatch.id,
      tournamentName,
      slotA: {
        userId: readyMatch.slotA.id,
        displayName: readyMatch.slotA.displayName,
        email: readyMatch.slotA.email,
      },
      slotB: {
        userId: readyMatch.slotB.id,
        displayName: readyMatch.slotB.displayName,
        email: readyMatch.slotB.email,
      },
    });
  }

  private async enqueueTournamentCompletedNotification(
    tournamentId: string,
    tournamentName: string,
    winnerId: string,
  ): Promise<void> {
    const winner = await this.prisma.user.findUnique({
      where: { id: winnerId },
      select: { email: true, displayName: true },
    });

    if (!winner) {
      return;
    }

    await this.notificationsQueue.enqueueTournamentCompletedMail({
      tournamentId,
      userId: winnerId,
      to: winner.email,
      displayName: TournamentProgressionService.sanitizeForTemplate(winner.displayName),
      tournamentName,
    });
  }

  private static sanitizeForTemplate(displayName: string): string {
    return displayName.replace(/__[A-Z_]+__/g, "");
  }
}
