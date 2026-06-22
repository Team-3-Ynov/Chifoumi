import { createHash } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditRoundDto, MatchAuditResponseDto } from "./dto/match-audit-response.dto.js";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async buildAudit(matchId: string): Promise<MatchAuditResponseDto> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        playerA: {
          select: {
            id: true,
            displayName: true,
          },
        },
        playerB: {
          select: {
            id: true,
            displayName: true,
          },
        },
        rounds: {
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    if (!match) {
      throw new NotFoundException({ error: "MATCH_NOT_FOUND" });
    }

    if (match.status !== MatchStatus.ended) {
      throw new ForbiddenException({
        error: "MATCH_NOT_ENDED",
        message: "Cannot view audit trail for matches that are still in progress",
      });
    }

    const auditRounds = match.rounds.map(
      (round) =>
        ({
          roundNumber: round.roundNumber,
          // Allow null values to include incomplete rounds with mismatch detection
          commitA: round.commitA,
          commitB: round.commitB,
          moveA: round.moveA,
          moveB: round.moveB,
          nonceA: round.nonceA,
          nonceB: round.nonceB,
          hashCheck: {
            a: this.verifyHash(round.moveA, round.nonceA, round.commitA),
            b: this.verifyHash(round.moveB, round.nonceB, round.commitB),
          },
        }) as AuditRoundDto,
    );

    return {
      matchId: match.id,
      players: [
        {
          id: match.playerA.id,
          displayName: match.playerA.displayName,
        },
        {
          id: match.playerB.id,
          displayName: match.playerB.displayName,
        },
      ],
      rounds: auditRounds,
      finalScore: [match.scoreA, match.scoreB],
      winner: match.winnerId,
      endedAt: match.endedAt!.toISOString(),
    };
  }

  private verifyHash(
    move: string | null,
    nonce: string | null,
    commit: string | null,
  ): "match" | "mismatch" {
    if (!move || !nonce || !commit) {
      return "mismatch";
    }

    const calculated = createHash("sha256").update(`${move}:${nonce}`).digest("hex");

    return calculated === commit ? "match" : "mismatch";
  }
}
