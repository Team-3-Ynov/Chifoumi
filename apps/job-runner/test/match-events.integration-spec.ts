import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { jest } from "@jest/globals";
import { Test, type TestingModule } from "@nestjs/testing";
import { Job, Queue } from "bullmq";
import { config } from "dotenv";
import { Redis } from "ioredis";
import type { MatchEndedPayload } from "../src/match-events/match-ended.types.js";
import { WorkerMetricsService } from "../src/metrics/worker-metrics.service.js";
import { MatchPersistenceService } from "../src/persistence/match-persistence.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { LEADERBOARD_INVALIDATE_CHANNEL } from "../src/redis/redis-invalidation.service.js";
import { RunnerService } from "../src/runner.service.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const bullmqPrefix = `rps-it-${process.pid}`;

process.env.DATABASE_URL ??= "postgresql://app:chifoumi_dev@localhost:5432/chifoumi";
process.env.REDIS_URL = redisUrl;
process.env.WORKER_QUEUES = "match-events";
process.env.WORKER_CONCURRENCY = "1";
process.env.WORKER_ROLE = "match-processor";
process.env.BULLMQ_PREFIX = bullmqPrefix;
process.env.MAIL_TRANSPORT = "mailhog";
process.env.MAIL_HOST = "localhost";
process.env.MAIL_PORT = "1025";
process.env.MAIL_FROM = "noreply@chifoumi.local";
process.env.CRON_ENABLED = "false";

const { AppModule } = await import("../src/app.module.js");

function createQueue(): Queue {
  return new Queue("match-events", {
    connection: { url: redisUrl },
    prefix: bullmqPrefix,
  });
}

async function waitForJobState(
  bullQueue: Queue,
  job: Job,
  expected: string,
  timeoutMs = 15_000,
): Promise<Job> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await Job.fromId(bullQueue, job.id as string);
    if (current && (await current.getState()) === expected) {
      return current;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Job ${job.id} did not reach state "${expected}" within ${timeoutMs}ms`);
}

function createPayload(matchId: string, playerAId: string, playerBId: string): MatchEndedPayload {
  return {
    matchId,
    players: [
      { userId: playerAId, displayName: "alice", rating: 1000 },
      { userId: playerBId, displayName: "bob", rating: 1000 },
    ],
    rounds: [
      {
        roundNumber: 1,
        moveA: "rock",
        moveB: "scissors",
        winner: "a",
        resolvedAt: "2026-06-09T10:00:01.000Z",
      },
      {
        roundNumber: 2,
        moveA: "paper",
        moveB: "rock",
        winner: "a",
        resolvedAt: "2026-06-09T10:00:02.000Z",
      },
    ],
    winner: playerAId,
    finalScore: { a: 2, b: 0 },
    startedAt: "2026-06-09T10:00:00.000Z",
  };
}

describe("match-events worker (integration)", () => {
  let moduleRef: TestingModule;
  let runnerService: RunnerService;
  let prisma: PrismaService;
  let persistence: MatchPersistenceService;
  let metrics: WorkerMetricsService;
  let queue: Queue;
  let redisSubscriber: Redis;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    runnerService = moduleRef.get(RunnerService);
    prisma = moduleRef.get(PrismaService);
    persistence = moduleRef.get(MatchPersistenceService);
    metrics = moduleRef.get(WorkerMetricsService);
    queue = createQueue();
    redisSubscriber = new Redis(redisUrl);

    await redisSubscriber.subscribe(LEADERBOARD_INVALIDATE_CHANNEL);
  }, 30_000);

  beforeEach(async () => {
    await queue.obliterate({ force: true });

    await prisma.eloHistory.deleteMany();
    await prisma.round.deleteMany();
    await prisma.match.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.eloRating.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await runnerService.onModuleDestroy();
    await queue.close();
    await redisSubscriber.quit();
    await moduleRef.close();
  }, 30_000);

  async function seedPlayers() {
    const playerAId = randomUUID();
    const playerBId = randomUUID();

    await prisma.user.create({
      data: {
        id: playerAId,
        email: `alice-${playerAId}@example.com`,
        passwordHash: "hash",
        displayName: "alice",
        eloRating: { create: { rating: 1000, gamesPlayed: 0 } },
      },
    });
    await prisma.user.create({
      data: {
        id: playerBId,
        email: `bob-${playerBId}@example.com`,
        passwordHash: "hash",
        displayName: "bob",
        eloRating: { create: { rating: 1000, gamesPlayed: 0 } },
      },
    });

    return { playerAId, playerBId };
  }

  it("persists a nominal match-ended event and invalidates the leaderboard cache", async () => {
    const { playerAId, playerBId } = await seedPlayers();
    const matchId = randomUUID();
    const payload = createPayload(matchId, playerAId, playerBId);

    const invalidationMessages: string[] = [];
    redisSubscriber.removeAllListeners("message");
    redisSubscriber.on("message", (channel, message) => {
      if (channel === LEADERBOARD_INVALIDATE_CHANNEL) {
        invalidationMessages.push(message);
      }
    });

    const job = await queue.add("match-ended", payload, { attempts: 3 });
    await waitForJobState(queue, job, "completed");

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    expect(match).toMatchObject({
      playerAId,
      playerBId,
      winnerId: playerAId,
      scoreA: 2,
      scoreB: 0,
      status: "ended",
    });

    const rounds = await prisma.round.findMany({
      where: { matchId },
      orderBy: { roundNumber: "asc" },
    });
    expect(rounds).toHaveLength(2);

    const history = await prisma.eloHistory.findMany({ where: { matchId } });
    expect(history).toHaveLength(2);

    const ratingA = await prisma.eloRating.findUnique({ where: { userId: playerAId } });
    const ratingB = await prisma.eloRating.findUnique({ where: { userId: playerBId } });
    expect(ratingA?.rating).toBe(1020);
    expect(ratingB?.rating).toBe(980);
    expect(invalidationMessages).toContain("*");
  });

  it("is idempotent when the same match-ended event is replayed", async () => {
    const { playerAId, playerBId } = await seedPlayers();
    const matchId = randomUUID();
    const payload = createPayload(matchId, playerAId, playerBId);

    const firstJob = await queue.add("match-ended", payload, { attempts: 3 });
    await waitForJobState(queue, firstJob, "completed");

    const ratingAfterFirst = await prisma.eloRating.findUnique({ where: { userId: playerAId } });

    const replayJob = await queue.add("match-ended", payload, { attempts: 3 });
    await waitForJobState(queue, replayJob, "completed");

    const historyCount = await prisma.eloHistory.count({ where: { matchId } });
    const ratingAfterReplay = await prisma.eloRating.findUnique({ where: { userId: playerAId } });

    expect(historyCount).toBe(2);
    expect(ratingAfterReplay?.rating).toBe(ratingAfterFirst?.rating);
    expect(ratingAfterReplay?.gamesPlayed).toBe(ratingAfterFirst?.gamesPlayed);
  });

  it("rejects invalid payloads permanently without retry", async () => {
    const job = await queue.add("match-ended", { invalid: true }, { attempts: 3 });
    const failedJob = await waitForJobState(queue, job, "failed");

    expect(failedJob.attemptsMade).toBeGreaterThanOrEqual(1);
    expect(failedJob.failedReason).toContain("Invalid match-ended job payload");
  });

  it("retries transient persistence failures and records retry metrics", async () => {
    const { playerAId, playerBId } = await seedPlayers();
    const matchId = randomUUID();
    const payload = createPayload(matchId, playerAId, playerBId);
    const original = persistence.persistMatchEnded.bind(persistence);

    const persistSpy = jest
      .spyOn(persistence, "persistMatchEnded")
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockImplementation((jobPayload) => original(jobPayload));

    const job = await queue.add("match-ended", payload, { attempts: 3 });
    await waitForJobState(queue, job, "completed");

    expect(persistSpy).toHaveBeenCalledTimes(2);

    const renderedMetrics = await metrics.getMetrics();
    expect(renderedMetrics).toContain('outcome="retry"');
    expect(renderedMetrics).toContain('outcome="completed"');

    persistSpy.mockRestore();
  });
});
