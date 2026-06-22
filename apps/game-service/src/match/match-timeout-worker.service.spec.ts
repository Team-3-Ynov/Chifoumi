import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Job } from "bullmq";
import { Logger } from "nestjs-pino";
import { MatchPlayService } from "./match-play.service.js";
import type { MatchTimeoutJobPayload } from "./match-timeout.types.js";
import { MatchTimeoutWorkerService } from "./match-timeout-worker.service.js";

describe("MatchTimeoutWorkerService", () => {
  let matchPlayService: MatchPlayService;
  let service: MatchTimeoutWorkerService;

  beforeEach(() => {
    matchPlayService = {
      handleMatchTimeout: jest.fn(async () => undefined),
    } as unknown as MatchPlayService;

    const logger = { warn: jest.fn() } as unknown as Logger;
    service = new MatchTimeoutWorkerService(
      { url: "redis://localhost:6379" },
      matchPlayService,
      logger,
    );
  });

  it("delegates timeout jobs to MatchPlayService", async () => {
    const job = {
      id: "job-1",
      data: {
        matchId: "match-1",
        roundNumber: 2,
        expectedState: "WAITING_PLAYS",
      },
    } as Job<MatchTimeoutJobPayload>;

    await service.processJob(job);

    expect(matchPlayService.handleMatchTimeout).toHaveBeenCalledWith("match-1", 2, "WAITING_PLAYS");
  });
});
