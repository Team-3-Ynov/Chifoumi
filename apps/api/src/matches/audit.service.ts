import { MatchStatus } from "@chifoumi/db";
import { verifyCommit } from "@chifoumi/schemas";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
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
      throw new NotFoundException({ error: "MATCH_NOT_FOUND" });
    }

    // Only ended matches are auditable; in-progress/aborted must not leak partial commits.
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
          a: verifyCommit(round.commitA, round.moveA, round.nonceA),
          b: verifyCommit(round.commitB, round.moveB, round.nonceB),
        },
      })),
      finalScore: {
        a: match.scoreA,
        b: match.scoreB,
      },
      winner: match.winnerId,
    };
  }
}
