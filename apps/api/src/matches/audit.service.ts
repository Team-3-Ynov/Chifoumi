import { MatchStatus, type Move } from "@chifoumi/db";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { verifyCommit } from "./commit-hash.js";
import type { MatchAuditResponseDto } from "./dto/match-audit-response.dto.js";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async buildAudit(matchId: string): Promise<MatchAuditResponseDto> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        rounds: {
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    if (!match) {
      throw new NotFoundException();
    }

    if (match.status !== MatchStatus.ended) {
      throw new ForbiddenException({ error: "MATCH_NOT_ENDED" });
    }

    return {
      matchId: match.id,
      players: [match.playerAId, match.playerBId],
      rounds: match.rounds.map((round) => ({
        roundNumber: round.roundNumber,
        commitA: round.commitA,
        commitB: round.commitB,
        moveA: round.moveA,
        moveB: round.moveB,
        nonceA: round.nonceA,
        nonceB: round.nonceB,
        hashCheck: {
          a: verifyCommit(round.commitA, this.moveToString(round.moveA), round.nonceA),
          b: verifyCommit(round.commitB, this.moveToString(round.moveB), round.nonceB),
        },
      })),
      finalScore: {
        a: match.scoreA,
        b: match.scoreB,
      },
      winner: match.winnerId,
    };
  }

  private moveToString(move: Move | null): string | null {
    return move ?? null;
  }
}
