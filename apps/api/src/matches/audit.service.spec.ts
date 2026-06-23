import { createHash } from "node:crypto";
import { jest } from "@jest/globals";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { MatchStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "./audit.service.js";

describe("AuditService", () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockMatch = {
    id: "123",
    playerAId: "player-a",
    playerBId: "player-b",
    winnerId: "player-a",
    scoreA: 2,
    scoreB: 1,
    startedAt: new Date("2026-06-22T10:00:00Z"),
    endedAt: new Date("2026-06-22T10:30:00Z"),
    status: MatchStatus.ended,
    playerA: {
      id: "player-a",
      displayName: "alice",
    },
    playerB: {
      id: "player-b",
      displayName: "bob",
    },
    rounds: [
      {
        id: "round-1",
        matchId: "123",
        roundNumber: 1,
        moveA: "rock",
        moveB: "paper",
        commitA: createHash("sha256").update("rock:nonce-a").digest("hex"),
        commitB: createHash("sha256").update("paper:nonce-b").digest("hex"),
        nonceA: "nonce-a",
        nonceB: "nonce-b",
        winner: "b",
        resolvedAt: new Date("2026-06-22T10:10:00Z"),
      },
      {
        id: "round-2",
        matchId: "123",
        roundNumber: 2,
        moveA: "scissors",
        moveB: "rock",
        commitA: createHash("sha256").update("scissors:nonce-a2").digest("hex"),
        commitB: createHash("sha256").update("rock:nonce-b2").digest("hex"),
        nonceA: "nonce-a2",
        nonceB: "nonce-b2",
        winner: "b",
        resolvedAt: new Date("2026-06-22T10:15:00Z"),
      },
      {
        id: "round-3",
        matchId: "123",
        roundNumber: 3,
        moveA: "paper",
        moveB: "scissors",
        commitA: createHash("sha256").update("paper:nonce-a3").digest("hex"),
        commitB: createHash("sha256").update("scissors:nonce-b3").digest("hex"),
        nonceA: "nonce-a3",
        nonceB: "nonce-b3",
        winner: "b",
        resolvedAt: new Date("2026-06-22T10:20:00Z"),
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            match: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe("buildAudit", () => {
    it("should return audit trail for ended match", async () => {
      jest.spyOn(prisma.match, "findUnique").mockResolvedValue(mockMatch);

      const result = await service.buildAudit("123");

      expect(result).toEqual({
        matchId: "123",
        players: [
          { id: "player-a", displayName: "alice" },
          { id: "player-b", displayName: "bob" },
        ],
        rounds: [
          {
            roundNumber: 1,
            // Non-null assertions safe: mockMatch.rounds is always populated
            commitA: mockMatch.rounds[0]!.commitA,
            commitB: mockMatch.rounds[0]!.commitB,
            moveA: "rock",
            moveB: "paper",
            nonceA: "nonce-a",
            nonceB: "nonce-b",
            hashCheck: { a: "match", b: "match" },
          },
          {
            roundNumber: 2,
            commitA: mockMatch.rounds[1]!.commitA,
            commitB: mockMatch.rounds[1]!.commitB,
            moveA: "scissors",
            moveB: "rock",
            nonceA: "nonce-a2",
            nonceB: "nonce-b2",
            hashCheck: { a: "match", b: "match" },
          },
          {
            roundNumber: 3,
            commitA: mockMatch.rounds[2]!.commitA,
            commitB: mockMatch.rounds[2]!.commitB,
            moveA: "paper",
            moveB: "scissors",
            nonceA: "nonce-a3",
            nonceB: "nonce-b3",
            hashCheck: { a: "match", b: "match" },
          },
        ],
        finalScore: [2, 1],
        winner: "player-a",
        endedAt: "2026-06-22T10:30:00.000Z",
      });
    });

    it("should throw NotFoundException for unknown match", async () => {
      jest.spyOn(prisma.match, "findUnique").mockResolvedValue(null);

      await expect(service.buildAudit("unknown")).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            error: "MATCH_NOT_FOUND",
          }),
        }),
      );
    });

    it("should throw ForbiddenException for in_progress match", async () => {
      const inProgressMatch = {
        ...mockMatch,
        status: MatchStatus.in_progress,
        endedAt: null,
      };
      jest.spyOn(prisma.match, "findUnique").mockResolvedValue(inProgressMatch);

      await expect(service.buildAudit("123")).rejects.toThrow(ForbiddenException);
    });

    it("should detect hash mismatch", async () => {
      const mismatchMatch = {
        ...mockMatch,
        rounds: [
          {
            ...mockMatch.rounds[0],
            commitA: "wrong-hash-value",
          },
        ],
      };
      jest.spyOn(prisma.match, "findUnique").mockResolvedValue(mismatchMatch);

      const result = await service.buildAudit("123");

      expect(result.rounds[0]!.hashCheck.a).toBe("mismatch");
      expect(result.rounds[0]!.hashCheck.b).toBe("match");
    });

    it("should include rounds with null fields as mismatch in hashCheck", async () => {
      const nullFieldsMatch = {
        ...mockMatch,
        rounds: [
          {
            ...mockMatch.rounds[0],
            moveA: null,
          },
        ],
      };
      jest.spyOn(prisma.match, "findUnique").mockResolvedValue(nullFieldsMatch);

      const result = await service.buildAudit("123");

      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0]!.hashCheck.a).toBe("mismatch");
      expect(result.rounds[0]!.hashCheck.b).toBe("match");
    });
  });
});
