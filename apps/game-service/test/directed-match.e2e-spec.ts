import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { Queue } from "bullmq";
import { config } from "dotenv";
import { io, type Socket } from "socket.io-client";
import { DirectedMatchService } from "../src/directed-match/directed-match.service.js";
import { RedisService } from "../src/redis/redis.service.js";
import { createGameServiceTestModule } from "../src/testing/create-game-service-test-module.js";
import { issueTestAccessToken } from "../src/testing/issue-test-access-token.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.MATCHMAKING_WORKER_ENABLED = "false";
process.env.MATCH_TIMEOUT_WORKER_ENABLED = "false";
process.env.BULLMQ_PREFIX ??= "rps-test-directed";
config({ path: resolve(repoRoot, ".env") });

const slotAId = "11111111-1111-4111-8111-111111111111";
const slotBId = "22222222-2222-4222-8222-222222222222";
const tournamentMatchId = "33333333-3333-4333-8333-333333333333";

type ConnectedPayload = { userId: string; displayName: string };
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

async function waitForQueueJob(
  queue: Queue,
  name: string,
  timeoutMs = 5_000,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const jobs = await queue.getJobs(["wait", "active", "delayed", "prioritized", "paused"]);
    const job = jobs.find((entry) => entry.name === name);
    if (job) {
      return job.data as Record<string, unknown>;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  return null;
}

async function connectAuthenticated(
  port: number,
  input: { userId: string; displayName: string },
): Promise<Socket> {
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
  return socket;
}

describe("Directed tournament match (e2e)", () => {
  let app: INestApplication;
  let port: number;
  let redisService: RedisService;
  let directedMatchService: DirectedMatchService;

  beforeAll(async () => {
    const moduleRef = await createGameServiceTestModule().compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    port = app.getHttpServer().address().port as number;
    redisService = app.get(RedisService);
    directedMatchService = app.get(DirectedMatchService);
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

  it("creates a directed match, plays BO3, and publishes tournamentMatchId in match-ended", async () => {
    await redisService.setex(`user:rating:${slotAId}`, 60, "1000");
    await redisService.setex(`user:rating:${slotBId}`, 60, "1040");

    const playerA = await connectAuthenticated(port, { userId: slotAId, displayName: "Ace" });
    const playerB = await connectAuthenticated(port, { userId: slotBId, displayName: "Bob" });

    const matchFoundA = waitForEvent<MatchFoundPayload>(playerA, "matchFound");
    const matchFoundB = waitForEvent<MatchFoundPayload>(playerB, "matchFound");
    const roundStartA = waitForEvent<RoundStartPayload>(playerA, "roundStart");
    const roundStartB = waitForEvent<RoundStartPayload>(playerB, "roundStart");

    const started = await directedMatchService.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(started).toEqual({ ok: true, matchId: expect.any(String) });
    if (!started.ok) {
      throw new Error("expected directed match to start");
    }

    const payloadA = await matchFoundA;
    const payloadB = await matchFoundB;
    expect(payloadA.matchId).toBe(started.matchId);
    expect(payloadB.matchId).toBe(started.matchId);

    const roundStart = await roundStartA;
    await roundStartB;

    const round1ResolvedA = waitForEvent<RoundResolvedPayload>(playerA, "roundResolved");
    const round1ResolvedB = waitForEvent<RoundResolvedPayload>(playerB, "roundResolved");

    playerA.emit("play", {
      matchId: started.matchId,
      roundNumber: roundStart.roundNumber,
      move: "rock",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    playerB.emit("play", {
      matchId: started.matchId,
      roundNumber: roundStart.roundNumber,
      move: "scissors",
    });
    await round1ResolvedA;
    await round1ResolvedB;

    const round2Start = await waitForEvent<RoundStartPayload>(playerA, "roundStart");
    await waitForEvent<RoundStartPayload>(playerB, "roundStart");

    const matchEndedA = waitForEvent<MatchEndedPayload>(playerA, "matchEnded");
    const matchEndedB = waitForEvent<MatchEndedPayload>(playerB, "matchEnded");

    playerA.emit("play", {
      matchId: started.matchId,
      roundNumber: round2Start.roundNumber,
      move: "paper",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    playerB.emit("play", {
      matchId: started.matchId,
      roundNumber: round2Start.roundNumber,
      move: "rock",
    });
    await matchEndedA;
    await matchEndedB;

    const queue = new Queue("match-events", {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
      prefix: process.env.BULLMQ_PREFIX ?? "rps-test-directed",
    });
    try {
      const jobData = await waitForQueueJob(queue, "match-ended");
      expect(jobData).toEqual(
        expect.objectContaining({
          matchId: started.matchId,
          tournamentMatchId,
        }),
      );
    } finally {
      await queue.close();
    }

    playerA.disconnect();
    playerB.disconnect();
  });

  it("rejects a second directed match when a player is already busy", async () => {
    await redisService.setex(`user:rating:${slotAId}`, 60, "1000");
    await redisService.setex(`user:rating:${slotBId}`, 60, "1040");

    const first = await directedMatchService.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });
    expect(first.ok).toBe(true);

    const second = await directedMatchService.startMatch({
      tournamentMatchId: "44444444-4444-4444-8444-444444444444",
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: "55555555-5555-4555-8555-555555555555", displayName: "Cara" },
    });

    expect(second).toEqual({ ok: false, code: "PLAYER_ALREADY_IN_MATCH" });
  });
});
