import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Queue } from "bullmq";
import Redis from "ioredis-mock";
import { RedisService } from "../redis/redis.service.js";
import { MATCH_TIMEOUT_JOB_NAME, matchTimeoutJobKey } from "./match-timeout.constants.js";
import { MatchTimeoutSchedulerService } from "./match-timeout-scheduler.service.js";

describe("MatchTimeoutSchedulerService", () => {
  let client: InstanceType<typeof Redis>;
  let redisService: RedisService;
  let service: MatchTimeoutSchedulerService;
  let queueAdd: jest.Mock;
  let queueGetJob: jest.Mock;
  let queueClose: jest.Mock;

  beforeEach(async () => {
    client = new Redis(`redis://match-timeout-test/${Date.now()}-${Math.random()}`);
    redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });

    queueAdd = jest.fn(async () => ({ id: "job-123", remove: jest.fn(async () => undefined) }));
    queueGetJob = jest.fn(async () => ({ remove: jest.fn(async () => undefined) }));
    queueClose = jest.fn(async () => undefined);

    service = new MatchTimeoutSchedulerService({ url: "redis://localhost:6379" }, redisService);
    Object.assign(service, {
      queue: {
        add: queueAdd,
        getJob: queueGetJob,
        close: queueClose,
      } as unknown as Queue,
    });
  });

  it("schedules a delayed job and stores its id in Redis", async () => {
    const jobId = await service.scheduleTimeout("match-1", 1, "WAITING_PLAYS", 5000);

    expect(jobId).toBe("job-123");
    expect(await client.get(matchTimeoutJobKey("match-1"))).toBe("job-123");
    expect(queueAdd).toHaveBeenCalledWith(
      MATCH_TIMEOUT_JOB_NAME,
      {
        matchId: "match-1",
        roundNumber: 1,
        expectedState: "WAITING_PLAYS",
      },
      expect.objectContaining({ delay: 5000 }),
    );
  });

  it("cancels a pending job before rescheduling for a new state", async () => {
    const remove = jest.fn<() => Promise<void>>(async () => undefined);
    queueGetJob.mockResolvedValue({ remove } as never);

    await service.scheduleTimeout("match-1", 1, "WAITING_PLAYS", 5000);
    await service.scheduleTimeout("match-1", 1, "WAITING_COMMITS", 5000);

    expect(remove).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd.mock.calls[1]?.[1]).toMatchObject({
      expectedState: "WAITING_COMMITS",
    });
  });

  it("removes the pending job on cancelTimeout", async () => {
    const remove = jest.fn<() => Promise<void>>(async () => undefined);
    queueGetJob.mockResolvedValue({ remove } as never);

    await service.scheduleTimeout("match-1", 1, "WAITING_PLAYS", 5000);
    await service.cancelTimeout("match-1");

    expect(remove).toHaveBeenCalled();
    expect(await client.get(matchTimeoutJobKey("match-1"))).toBeNull();
  });
});
