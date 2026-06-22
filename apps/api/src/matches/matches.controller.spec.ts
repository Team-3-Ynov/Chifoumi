import { jest } from "@jest/globals";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditService } from "./audit.service.js";
import { MatchAuditResponseDto } from "./dto/match-audit-response.dto.js";
import { MatchesController } from "./matches.controller.js";

describe("MatchesController", () => {
  let controller: MatchesController;
  let auditService: AuditService;

  const mockAuditResponse: MatchAuditResponseDto = {
    matchId: "123",
    players: [
      { id: "player-a", displayName: "alice" },
      { id: "player-b", displayName: "bob" },
    ],
    rounds: [
      {
        roundNumber: 1,
        commitA: "abc123",
        commitB: "xyz789",
        moveA: "rock" as const,
        moveB: "paper" as const,
        nonceA: "nonce-a",
        nonceB: "nonce-b",
        hashCheck: { a: "match" as const, b: "match" as const },
      },
    ],
    finalScore: [2, 1],
    winner: "player-a",
    endedAt: "2026-06-22T10:30:00.000Z",
  };

  beforeEach(() => {
    auditService = {
      buildAudit: jest.fn(),
    } as unknown as AuditService;

    controller = new MatchesController(auditService);
  });

  describe("getAudit", () => {
    it("should return audit trail for valid match", async () => {
      jest.spyOn(auditService, "buildAudit").mockResolvedValue(mockAuditResponse);

      const result = await controller.getAudit("123");

      expect(result).toEqual(mockAuditResponse);
      expect(auditService.buildAudit).toHaveBeenCalledWith("123");
    });

    it("should propagate NotFoundException from service", async () => {
      jest.spyOn(auditService, "buildAudit").mockRejectedValue(new NotFoundException());

      await expect(controller.getAudit("unknown")).rejects.toThrow(NotFoundException);
    });

    it("should propagate ForbiddenException for in_progress match", async () => {
      jest
        .spyOn(auditService, "buildAudit")
        .mockRejectedValue(new ForbiddenException("MATCH_NOT_ENDED"));

      await expect(controller.getAudit("123")).rejects.toThrow(ForbiddenException);
    });
  });
});
