import { MatchStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "./audit.service.js";
import { computeCommitHash } from "./commit-hash.js";

describe("computeCommitHash", () => {
  it("hashes move and nonce with SHA256", () => {
    const hash = computeCommitHash("rock", "abc123");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(computeCommitHash("rock", "abc123"));
    expect(hash).not.toBe(computeCommitHash("paper", "abc123"));
  });
});

describe("AuditService", () => {
  let service: AuditService;
  let prisma: { match: { findUnique: ReturnType<typeof jest.fn> } };

  beforeEach(() => {
    prisma = {
      match: {
        findUnique: jest.fn(),
      },
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it("throws NotFoundException when match is missing", async () => {
    prisma.match.findUnique.mockResolvedValue(null);

    await expect(service.buildAudit("00000000-0000-4000-8000-000000000001")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("throws ForbiddenException when match is not ended", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.in_progress,
      playerAId: "player-a",
      playerBId: "player-b",
      scoreA: 1,
      scoreB: 0,
      winnerId: null,
      rounds: [],
    });

    await expect(service.buildAudit("match-1")).rejects.toMatchObject({
      response: { error: "MATCH_NOT_ENDED" },
    });
    await expect(service.buildAudit("match-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("builds audit payload with hash verification", async () => {
    const nonceA = "nonce-a";
    const nonceB = "nonce-b";
    const commitA = computeCommitHash("rock", nonceA);
    const commitB = computeCommitHash("paper", nonceB);

    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.ended,
      playerAId: "player-a",
      playerBId: "player-b",
      scoreA: 2,
      scoreB: 1,
      winnerId: "player-a",
      rounds: [
        {
          roundNumber: 1,
          commitA,
          commitB,
          moveA: "rock",
          moveB: "paper",
          nonceA,
          nonceB,
        },
      ],
    });

    const audit = await service.buildAudit("match-1");

    expect(audit).toEqual({
      matchId: "match-1",
      players: ["player-a", "player-b"],
      rounds: [
        {
          roundNumber: 1,
          commitA,
          commitB,
          moveA: "rock",
          moveB: "paper",
          nonceA,
          nonceB,
          hashCheck: { a: "match", b: "match" },
        },
      ],
      finalScore: { a: 2, b: 1 },
      winner: "player-a",
    });
  });

  it("flags hash mismatch when commit does not match reveal", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.ended,
      playerAId: "player-a",
      playerBId: "player-b",
      scoreA: 2,
      scoreB: 0,
      winnerId: "player-a",
      rounds: [
        {
          roundNumber: 1,
          commitA: computeCommitHash("rock", "real-nonce"),
          commitB: computeCommitHash("scissors", "nonce-b"),
          moveA: "paper",
          moveB: "scissors",
          nonceA: "real-nonce",
          nonceB: "nonce-b",
        },
      ],
    });

    const audit = await service.buildAudit("match-1");

    expect(audit.rounds[0]?.hashCheck).toEqual({ a: "mismatch", b: "match" });
  });
});
