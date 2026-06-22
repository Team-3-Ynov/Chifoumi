import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { Worker } from "bullmq";
import { config } from "dotenv";
import { io, type Socket } from "socket.io-client";
import {
  MATCH_DISCONNECT_FORFEIT_QUEUE,
  matchDisconnectForfeitJobKey,
} from "../src/match/match-disconnect.constants.js";
import { MatchDisconnectSchedulerService } from "../src/match/match-disconnect-scheduler.service.js";
import { MatchPlayService } from "../src/match/match-play.service.js";
import { MatchmakingWorkerService } from "../src/matchmaking/matchmaking-worker.service.js";
import { RedisService } from "../src/redis/redis.service.js";
import { createGameServiceTestModule } from "../src/testing/create-game-service-test-module.js";
import { issueTestAccessToken } from "../src/testing/issue-test-access-token.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.MATCHMAKING_WORKER_ENABLED = "false";
process.env.MATCH_DISCONNECT_WORKER_ENABLED = "false";
process.env.BULLMQ_PREFIX ??= "rps-test";

type ConnectedPayload = { userId: string; displayName: string };
type QueueJoinedPayload = { queuedAt: string; currentRating: number };
type MatchFoundPayload = {
  matchId: string;
  opponent: { userId: string; displayName: string; rating: number };
  bestOf: number;
};
type RoundStartPayload = { matchId: string; roundNumber: number; deadline: string };
type MatchResumedPayload = {
  matchId: string;
  currentRound: number;
  scoreA: number;
  scoreB: number;
  currentState: string;
  deadline: string;
};
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

describe("Match reconnect WS (e2e)", () => {
  let app: INestApplication;
  let port: number;
  let redisService: RedisService;
  let worker: MatchmakingWorkerService;
  let disconnectScheduler: MatchDisconnectSchedulerService;
  let matchPlayService: MatchPlayService;
  let recoveryWorker: Worker | null = null;

  beforeAll(async () => {
    const moduleRef = await createGameServiceTestModule().compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    port = app.getHttpServer().address().port as number;
    redisService = app.get(RedisService);
    worker = app.get(MatchmakingWorkerService);
    disconnectScheduler = app.get(MatchDisconnectSchedulerService);
    matchPlayService = app.get(MatchPlayService);
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

  it("resumes an active match when the player reconnects on the same instance", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    playerA.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await redisService.get(matchDisconnectForfeitJobKey("player-a"))).toBeTruthy();

    const token = await issueTestAccessToken({ userId: "player-a", displayName: "Ace" });
    const reconnected = connectClient(port, token);
    const connected = waitForEvent<ConnectedPayload>(reconnected, "connected");
    const resumed = waitForEvent<MatchResumedPayload>(reconnected, "matchResumed");

    await new Promise<void>((resolvePromise, reject) => {
      reconnected.once("connect", () => resolvePromise());
      reconnected.once("connect_error", reject);
    });

    await connected;
    const payload = await resumed;

    expect(payload).toEqual({
      matchId,
      currentRound: roundStart.roundNumber,
      scoreA: 0,
      scoreB: 0,
      currentState: "WAITING_PLAYS",
      deadline: roundStart.deadline,
    });
    expect(await redisService.get(matchDisconnectForfeitJobKey("player-a"))).toBeNull();

    reconnected.disconnect();
    playerB.disconnect();
  });

  it("resumes an active match when the player reconnects on another instance", async () => {
    const moduleRef = await createGameServiceTestModule().compile();
    const secondApp = moduleRef.createNestApplication();
    await secondApp.init();
    await secondApp.listen(0, "127.0.0.1");
    const secondPort = secondApp.getHttpServer().address().port as number;

    try {
      const { playerA, playerB, matchId, roundStart } = await pairPlayers();

      playerA.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const token = await issueTestAccessToken({ userId: "player-a", displayName: "Ace" });
      const reconnected = connectClient(secondPort, token);
      const connected = waitForEvent<ConnectedPayload>(reconnected, "connected");
      const resumed = waitForEvent<MatchResumedPayload>(reconnected, "matchResumed");

      await new Promise<void>((resolvePromise, reject) => {
        reconnected.once("connect", () => resolvePromise());
        reconnected.once("connect_error", reject);
      });

      await connected;
      const payload = await resumed;

      expect(payload.matchId).toBe(matchId);
      expect(payload.currentState).toBe("WAITING_PLAYS");
      expect(payload.deadline).toBe(roundStart.deadline);

      reconnected.disconnect();
      playerB.disconnect();
    } finally {
      await secondApp.close();
    }
  });

  it("forfeits the disconnected player after the reconnect window expires", async () => {
    const { playerA, playerB, matchId } = await pairPlayers();

    playerA.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    await disconnectScheduler.cancelForfeit("player-a");
    await disconnectScheduler.scheduleForfeit("player-a", matchId, 200);

    recoveryWorker = new Worker(
      MATCH_DISCONNECT_FORFEIT_QUEUE,
      async (job) => {
        await matchPlayService.handleDisconnectForfeit(job.data.userId, job.data.matchId);
      },
      {
        connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
        prefix: process.env.BULLMQ_PREFIX ?? "rps-test",
      },
    );

    try {
      const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");
      const ended = await matchEndedB;

      expect(ended.reason).toBe("DISCONNECT_FORFEIT");
      expect(ended.winner).toBe("player-b");
    } finally {
      await recoveryWorker.close();
      recoveryWorker = null;
      playerB.disconnect();
    }
  });

  it("exposes match reconnect prometheus metrics", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("match_reconnect_total");
  });
});
