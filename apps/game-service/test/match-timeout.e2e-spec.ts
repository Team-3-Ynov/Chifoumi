import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { config } from "dotenv";
import { io, type Socket } from "socket.io-client";
import { MatchPlayService } from "../src/match/match-play.service.js";
import { MATCH_TIMEOUT_QUEUE, matchTimeoutJobKey } from "../src/match/match-timeout.constants.js";
import { MatchTimeoutSchedulerService } from "../src/match/match-timeout-scheduler.service.js";
import { MatchSessionService } from "../src/match-session/match-session.service.js";
import { MatchmakingWorkerService } from "../src/matchmaking/matchmaking-worker.service.js";
import { RedisService } from "../src/redis/redis.service.js";
import { createGameServiceTestModule } from "../src/testing/create-game-service-test-module.js";
import { issueTestAccessToken } from "../src/testing/issue-test-access-token.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.MATCHMAKING_WORKER_ENABLED = "false";
process.env.MATCH_TIMEOUT_WORKER_ENABLED = "false";
process.env.BULLMQ_PREFIX ??= "rps-test";
config({ path: resolve(repoRoot, ".env") });

type ConnectedPayload = { userId: string; displayName: string };
type QueueJoinedPayload = { queuedAt: string; currentRating: number };
type MatchFoundPayload = {
  matchId: string;
  opponent: { userId: string; displayName: string; rating: number };
  bestOf: number;
};
type RoundStartPayload = { matchId: string; roundNumber: number; deadline: string };
type MatchEndedPayload = {
  matchId: string;
  winner: string | null;
  finalScore: { a: number; b: number };
  eloDelta: { a: number; b: number };
  reason?: string;
};

function connectClient(port: number, token: string): Socket {
  return io(`http://127.0.0.1:${port}/game`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    query: { token },
  });
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} timeout`)), 10_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolvePromise(payload);
    });
  });
}

async function waitForDelayedTimeoutJob(
  queue: Queue,
  matchId: string,
  roundNumber: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rawJobs = await queue.getJobs(["delayed"]);
    const jobs = rawJobs.filter(
      (job): job is NonNullable<(typeof rawJobs)[number]> => job?.data != null,
    );
    const match = jobs.find(
      (job) => job?.data.matchId === matchId && job.data.roundNumber === roundNumber,
    );
    if (match) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `timed out waiting for delayed timeout job (match=${matchId}, round=${roundNumber})`,
  );
}

async function connectAndJoin(
  port: number,
  input: { userId: string; displayName: string },
): Promise<{ socket: Socket; queueJoined: QueueJoinedPayload }> {
  const token = await issueTestAccessToken({
    userId: input.userId,
    displayName: input.displayName,
  });
  const socket = connectClient(port, token);
  const connectedPromise = waitForEvent<ConnectedPayload>(socket, "connected");

  await new Promise<void>((resolvePromise, reject) => {
    socket.once("connect", () => resolvePromise());
    socket.once("connect_error", reject);
  });

  await connectedPromise;
  socket.emit("joinQueue", {});
  const queueJoined = await waitForEvent<QueueJoinedPayload>(socket, "queueJoined");

  return { socket, queueJoined };
}

describe("Match timeout BullMQ (e2e)", () => {
  let app: INestApplication;
  let port: number;
  let redisService: RedisService;
  let worker: MatchmakingWorkerService;
  let scheduler: MatchTimeoutSchedulerService;
  let matchPlayService: MatchPlayService;
  let matchSessionService: MatchSessionService;
  let recoveryWorker: Worker | null = null;

  beforeAll(async () => {
    const moduleRef = await createGameServiceTestModule().compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    port = app.getHttpServer().address().port as number;
    redisService = app.get(RedisService);
    worker = app.get(MatchmakingWorkerService);
    scheduler = app.get(MatchTimeoutSchedulerService);
    matchPlayService = app.get(MatchPlayService);
    matchSessionService = app.get(MatchSessionService);
  });

  afterAll(async () => {
    if (recoveryWorker) {
      await recoveryWorker.close();
      recoveryWorker = null;
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    const client = redisService.getClient();
    const keys = await client.keys("*");
    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  async function pairPlayers(): Promise<{
    playerA: Socket;
    playerB: Socket;
    matchId: string;
    roundStart: RoundStartPayload;
  }> {
    await redisService.setex("user:rating:player-a", 60, "1000");
    await redisService.setex("user:rating:player-b", 60, "1040");

    const joinedA = await connectAndJoin(port, { userId: "player-a", displayName: "Ace" });
    const joinedB = await connectAndJoin(port, { userId: "player-b", displayName: "Bob" });

    const matchFoundA = waitForEvent<MatchFoundPayload>(joinedA.socket, "matchFound");
    const matchFoundB = waitForEvent<MatchFoundPayload>(joinedB.socket, "matchFound");
    const roundStartA = waitForEvent<RoundStartPayload>(joinedA.socket, "roundStart");
    const roundStartB = waitForEvent<RoundStartPayload>(joinedB.socket, "roundStart");

    await worker.tick();

    const payloadA = await matchFoundA;
    await matchFoundB;
    const roundStart = await roundStartA;
    await roundStartB;

    return {
      playerA: joinedA.socket,
      playerB: joinedB.socket,
      matchId: payloadA.matchId,
      roundStart,
    };
  }

  it("cancels the pending timeout when both players submit before the deadline", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    const queue = new Queue(MATCH_TIMEOUT_QUEUE, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
      prefix: process.env.BULLMQ_PREFIX ?? "rps-test",
    });

    try {
      playerA.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "rock" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      playerB.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "scissors" });
      await waitForEvent(playerA, "roundResolved");
      await waitForEvent(playerB, "roundResolved");
      await waitForDelayedTimeoutJob(queue, matchId, 2);

      const timeoutJobId = await redisService.get(matchTimeoutJobKey(matchId));
      expect(timeoutJobId).toBeTruthy();

      const rawDelayedJobs = await queue.getJobs(["delayed"]);
      const delayedJobs = rawDelayedJobs.filter(
        (job): job is NonNullable<(typeof rawDelayedJobs)[number]> => job?.data != null,
      );
      expect(delayedJobs).toHaveLength(1);
      expect(delayedJobs[0]?.data).toMatchObject({
        matchId,
        roundNumber: 2,
        expectedState: "WAITING_PLAYS",
      });
    } finally {
      await queue.close();
      playerA.disconnect();
      playerB.disconnect();
    }
  });

  it("applies play-phase forfeit when another instance consumes the delayed timeout job", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    await matchSessionService.mutateState(matchId, (state) => ({
      ...state,
      roundPlays: { a: "rock", b: null },
    }));

    await scheduler.cancelTimeout(matchId);
    await scheduler.scheduleTimeout(matchId, roundStart.roundNumber, "WAITING_PLAYS", 200);

    recoveryWorker = new Worker(
      MATCH_TIMEOUT_QUEUE,
      async (job) => {
        await matchPlayService.handleMatchTimeout(
          job.data.matchId,
          job.data.roundNumber,
          job.data.expectedState,
        );
      },
      {
        connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
        prefix: process.env.BULLMQ_PREFIX ?? "rps-test",
      },
    );

    try {
      const matchEndedA = waitForEvent<MatchEndedPayload>(playerA, "matchEnded");
      const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");

      const endedA = await matchEndedA;
      const endedB = await matchEndedB;

      expect(endedA.reason).toBe("FORFEIT_TIMEOUT");
      expect(endedB.reason).toBe("FORFEIT_TIMEOUT");
      expect(endedA.winner).toBe("player-a");
      expect(endedB.winner).toBe("player-a");
    } finally {
      await recoveryWorker.close();
      recoveryWorker = null;
      playerA.disconnect();
      playerB.disconnect();
    }
  });

  it("applies reveal-phase forfeit when a recovery worker consumes the delayed job", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    await matchSessionService.mutateState(matchId, (state) => ({
      ...state,
      status: "WAITING_REVEALS",
      roundCommits: { a: "abc123", b: "def456" },
      roundReveals: { a: "rock", b: null },
      revealDeadline: new Date(Date.now() + 200).toISOString(),
    }));

    await scheduler.cancelTimeout(matchId);
    await scheduler.scheduleTimeout(matchId, roundStart.roundNumber, "WAITING_REVEALS", 200);

    recoveryWorker = new Worker(
      MATCH_TIMEOUT_QUEUE,
      async (job) => {
        await matchPlayService.handleMatchTimeout(
          job.data.matchId,
          job.data.roundNumber,
          job.data.expectedState,
        );
      },
      {
        connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
        prefix: process.env.BULLMQ_PREFIX ?? "rps-test",
      },
    );

    try {
      const matchEndedA = waitForEvent<MatchEndedPayload>(playerA, "matchEnded");
      const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");

      const endedA = await matchEndedA;
      const endedB = await matchEndedB;

      expect(endedA.reason).toBe("FORFEIT_TIMEOUT");
      expect(endedB.reason).toBe("FORFEIT_TIMEOUT");
      expect(endedA.winner).toBe("player-a");
    } finally {
      await recoveryWorker.close();
      recoveryWorker = null;
      playerA.disconnect();
      playerB.disconnect();
    }
  });

  it("ends reveal-phase timeout without a winner when both players are silent", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    await matchSessionService.mutateState(matchId, (state) => ({
      ...state,
      status: "WAITING_REVEALS",
      roundCommits: { a: "abc123", b: "def456" },
      roundReveals: { a: null, b: null },
      revealDeadline: new Date(Date.now() + 200).toISOString(),
    }));

    await scheduler.cancelTimeout(matchId);
    await scheduler.scheduleTimeout(matchId, roundStart.roundNumber, "WAITING_REVEALS", 200);

    recoveryWorker = new Worker(
      MATCH_TIMEOUT_QUEUE,
      async (job) => {
        await matchPlayService.handleMatchTimeout(
          job.data.matchId,
          job.data.roundNumber,
          job.data.expectedState,
        );
      },
      {
        connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
        prefix: process.env.BULLMQ_PREFIX ?? "rps-test",
      },
    );

    try {
      const matchEndedA = waitForEvent<MatchEndedPayload>(playerA, "matchEnded");
      const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");

      const endedA = await matchEndedA;
      const endedB = await matchEndedB;

      expect(endedA.reason).toBe("FORFEIT_TIMEOUT");
      expect(endedB.reason).toBe("FORFEIT_TIMEOUT");
      expect(endedA.winner).toBeNull();
      expect(endedB.winner).toBeNull();
    } finally {
      await recoveryWorker.close();
      recoveryWorker = null;
      playerA.disconnect();
      playerB.disconnect();
    }
  });
});
