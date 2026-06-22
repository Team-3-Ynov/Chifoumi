import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { Queue } from "bullmq";
import { config } from "dotenv";
import { io, type Socket } from "socket.io-client";
import { MatchmakingWorkerService } from "../src/matchmaking/matchmaking-worker.service.js";
import { RedisService } from "../src/redis/redis.service.js";
import { createGameServiceTestModule } from "../src/testing/create-game-service-test-module.js";
import { issueTestAccessToken, testJwtKeys } from "../src/testing/issue-test-access-token.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

process.env.JWT_PUBLIC_KEY = testJwtKeys.publicKey;
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.MATCHMAKING_WORKER_ENABLED = "false";
process.env.BULLMQ_PREFIX ??= "rps-test";

type ConnectedPayload = { userId: string; displayName: string };
type QueueJoinedPayload = { queuedAt: string; currentRating: number };
type MatchFoundPayload = {
  matchId: string;
  opponent: { userId: string; displayName: string; rating: number };
  bestOf: number;
};
type RoundStartPayload = { matchId: string; roundNumber: number; deadline: string };
type RoundResolvedPayload = {
  matchId: string;
  roundNumber: number;
  yourMove: string;
  theirMove: string;
  winner: string;
  scoreA: number;
  scoreB: number;
};
type MatchEndedPayload = {
  matchId: string;
  winner: string | null;
  finalScore: { a: number; b: number };
  eloDelta: { a: number; b: number };
  reason?: string;
};
type ErrorPayload = { code: string; message: string };

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

describe("Match play BO3 (e2e)", () => {
  let app: INestApplication;
  let port: number;
  let redisService: RedisService;
  let worker: MatchmakingWorkerService;

  beforeAll(async () => {
    const moduleRef = await createGameServiceTestModule().compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    port = app.getHttpServer().address().port as number;
    redisService = app.get(RedisService);
    worker = app.get(MatchmakingWorkerService);
  });

  afterAll(async () => {
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

  it("emits roundResolved and matchEnded exactly once per player", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    let roundResolvedCountA = 0;
    let roundResolvedCountB = 0;
    let matchEndedCountA = 0;
    let matchEndedCountB = 0;

    playerA.on("roundResolved", () => {
      roundResolvedCountA += 1;
    });
    playerB.on("roundResolved", () => {
      roundResolvedCountB += 1;
    });
    playerA.on("matchEnded", () => {
      matchEndedCountA += 1;
    });
    playerB.on("matchEnded", () => {
      matchEndedCountB += 1;
    });

    const round1ResolvedA = waitForEvent<RoundResolvedPayload>(playerA, "roundResolved");
    const round1ResolvedB = waitForEvent<RoundResolvedPayload>(playerB, "roundResolved");
    const matchEndedA = waitForEvent<MatchEndedPayload>(playerA, "matchEnded");
    const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");

    playerA.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "rock" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    playerB.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "scissors" });
    await round1ResolvedA;
    await round1ResolvedB;

    const round2Start = await waitForEvent<RoundStartPayload>(playerA, "roundStart");
    await waitForEvent<RoundStartPayload>(playerB, "roundStart");

    playerA.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "paper" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    playerB.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "rock" });
    await matchEndedA;
    await matchEndedB;

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(roundResolvedCountA).toBe(2);
    expect(roundResolvedCountB).toBe(2);
    expect(matchEndedCountA).toBe(1);
    expect(matchEndedCountB).toBe(1);

    playerA.disconnect();
    playerB.disconnect();
  });

  it("plays a full 2-0 BO3 match with roundResolved and matchEnded", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    const round1ResolvedA = waitForEvent<RoundResolvedPayload>(playerA, "roundResolved");
    const round1ResolvedB = waitForEvent<RoundResolvedPayload>(playerB, "roundResolved");

    playerA.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "rock" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    playerB.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "scissors" });

    const resolvedA = await round1ResolvedA;
    const resolvedB = await round1ResolvedB;
    expect(resolvedA.winner).toBe("a");
    expect(resolvedB.winner).toBe("a");
    expect(resolvedA.scoreA).toBe(1);

    const round2Start = await waitForEvent<RoundStartPayload>(playerA, "roundStart");
    await waitForEvent<RoundStartPayload>(playerB, "roundStart");

    const matchEndedA = waitForEvent<MatchEndedPayload>(playerA, "matchEnded");
    const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");
    const round2ResolvedA = waitForEvent<RoundResolvedPayload>(playerA, "roundResolved");

    playerA.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "paper" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    playerB.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "rock" });
    await round2ResolvedA;

    const endedA = await matchEndedA;
    const endedB = await matchEndedB;

    expect(endedA.winner).toBe("player-a");
    expect(endedA.finalScore).toEqual({ a: 2, b: 0 });
    expect(endedB.finalScore).toEqual({ a: 2, b: 0 });
    expect(await redisService.get("match:byUser:player-a")).toBeNull();

    const queue = new Queue("match-events", {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
      prefix: process.env.BULLMQ_PREFIX ?? "rps-test",
    });
    const jobs = await queue.getJobs(["completed", "waiting", "active"]);
    expect(jobs.some((job) => job.name === "match-ended")).toBe(true);
    await queue.close();

    playerA.disconnect();
    playerB.disconnect();
  });

  it("returns INVALID_MOVE for unknown moves", async () => {
    const { playerA, playerB, matchId, roundStart } = await pairPlayers();

    const errorPromise = waitForEvent<ErrorPayload>(playerA, "error");
    playerA.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "lizard" });
    const error = await errorPromise;

    expect(error.code).toBe("INVALID_MOVE");
    playerA.disconnect();
    playerB.disconnect();
  });

  it("returns WRONG_ROUND for stale round numbers", async () => {
    const { playerA, playerB, matchId } = await pairPlayers();

    const errorPromise = waitForEvent<ErrorPayload>(playerA, "error");
    playerA.emit("play", { matchId, roundNumber: 99, move: "rock" });
    const error = await errorPromise;

    expect(error.code).toBe("WRONG_ROUND");
    playerA.disconnect();
    playerB.disconnect();
  });
});
