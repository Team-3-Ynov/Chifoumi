import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Queue } from "bullmq";
import Redis from "ioredis-mock";
import { RedisService } from "../redis/redis.service.js";
import {
  MATCH_DISCONNECT_FORFEIT_FAILED_JOBS_RETAINED,
  MATCH_DISCONNECT_FORFEIT_JOB_ATTEMPTS,
  MATCH_DISCONNECT_FORFEIT_JOB_BACKOFF_MS,
  MATCH_DISCONNECT_FORFEIT_JOB_NAME,
  matchDisconnectForfeitJobKey,
} from "./match-disconnect.constants.js";
import { MatchDisconnectSchedulerService } from "./match-disconnect-scheduler.service.js";

describe("MatchDisconnectSchedulerService", () => {
  let client: InstanceType<typeof Redis>;
  let redisService: RedisService;
  let service: MatchDisconnectSchedulerService;
  let queueAdd: jest.Mock;
  let queueGetJob: jest.Mock;

  beforeEach(async () => {
    client = new Redis(`redis://match-disconnect-test/${Date.now()}-${Math.random()}`);
    redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });

    queueAdd = jest.fn(async () => ({ id: "job-123", remove: jest.fn(async () => undefined) }));
    queueGetJob = jest.fn(async () => ({ remove: jest.fn(async () => undefined) }));

    service = new MatchDisconnectSchedulerService({ url: "redis://localhost:6379" }, redisService);
    Object.assign(service, {
      queue: {
        add: queueAdd,
        getJob: queueGetJob,
        close: jest.fn(async () => undefined),
      } as unknown as Queue,
    });
  });

  it("schedules a delayed forfeit job with retry/backoff and retained failures", async () => {
    const jobId = await service.scheduleForfeit("player-a", "match-1", 10_000);

    expect(jobId).toBe("job-123");
    expect(await client.get(matchDisconnectForfeitJobKey("player-a"))).toBe("job-123");
    expect(queueAdd).toHaveBeenCalledWith(
      MATCH_DISCONNECT_FORFEIT_JOB_NAME,
      { userId: "player-a", matchId: "match-1" },
      expect.objectContaining({
        delay: 10_000,
        attempts: MATCH_DISCONNECT_FORFEIT_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: MATCH_DISCONNECT_FORFEIT_JOB_BACKOFF_MS,
        },
        removeOnComplete: true,
        removeOnFail: MATCH_DISCONNECT_FORFEIT_FAILED_JOBS_RETAINED,
      }),
    );
  });

  it("cancels a pending forfeit job before rescheduling", async () => {
    const remove = jest.fn<() => Promise<void>>(async () => undefined);
    queueGetJob.mockResolvedValue({ remove } as never);

    await service.scheduleForfeit("player-a", "match-1");
    await service.scheduleForfeit("player-a", "match-1");

    expect(remove).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledTimes(2);
  });
});
