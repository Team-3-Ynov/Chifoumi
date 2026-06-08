import type { Prisma } from "@chifoumi/db";
import { MatchStatus } from "@chifoumi/db";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { decodeHistoryCursor, encodeHistoryCursor } from "./history-cursor.js";

export type MeHistoryItem = {
  matchId: string;
  opponent: {
    displayName: string;
    ratingAtMatch: number;
  };
  scoreA: number;
  scoreB: number;
  isWinner: boolean;
  eloDelta: number;
  endedAt: Date;
};

export type MeHistoryPage = {
  items: MeHistoryItem[];
  nextCursor: string | null;
};

@Injectable()
export class MeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(userId: string, limit: number, cursor?: string): Promise<MeHistoryPage> {
    const decodedCursor = cursor ? decodeHistoryCursor(cursor) : undefined;

    const where: Prisma.MatchWhereInput = {
      status: MatchStatus.ended,
      endedAt: { not: null },
      OR: [{ playerAId: userId }, { playerBId: userId }],
      ...(decodedCursor
        ? {
            AND: [
              {
                OR: [
                  { endedAt: { lt: new Date(decodedCursor.ts) } },
                  {
                    endedAt: new Date(decodedCursor.ts),
                    id: { lt: decodedCursor.id },
                  },
                ],
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.match.findMany({
      where,
      orderBy: [{ endedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
        eloHistory: true,
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items = pageRows.map((match) => this.toHistoryItem(match, userId));

    const last = pageRows.at(-1);
    const nextCursor = hasMore && last?.endedAt ? encodeHistoryCursor(last.endedAt, last.id) : null;

    return { items, nextCursor };
  }

  private toHistoryItem(
    match: {
      id: string;
      playerAId: string;
      playerBId: string;
      winnerId: string | null;
      scoreA: number;
      scoreB: number;
      endedAt: Date | null;
      playerA: { id: string; displayName: string };
      playerB: { id: string; displayName: string };
      eloHistory: Array<{
        userId: string;
        ratingBefore: number;
        delta: number;
      }>;
    },
    userId: string,
  ): MeHistoryItem {
    const isPlayerA = match.playerAId === userId;
    const opponent = isPlayerA ? match.playerB : match.playerA;
    const myHistory = match.eloHistory.find((entry) => entry.userId === userId);
    const opponentHistory = match.eloHistory.find((entry) => entry.userId === opponent.id);

    return {
      matchId: match.id,
      opponent: {
        displayName: opponent.displayName,
        ratingAtMatch: opponentHistory?.ratingBefore ?? 1000,
      },
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      isWinner: match.winnerId === userId,
      eloDelta: myHistory?.delta ?? 0,
      endedAt: match.endedAt as Date,
    };
  }
}
