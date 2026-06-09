import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module.js";
import { JWT_CONFIG } from "../src/config/jwt.config.js";
import { MATCHMAKING_WORKER_INTERVAL_MS } from "../src/matchmaking/matchmaking.constants.js";
import { MatchmakingWorkerService } from "../src/matchmaking/matchmaking-worker.service.js";
import { RedisService } from "../src/redis/redis.service.js";
import { issueTestAccessToken, testJwtKeys } from "../src/testing/issue-test-access-token.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

process.env.JWT_PUBLIC_KEY = testJwtKeys.publicKey;
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.MATCHMAKING_WORKER_ENABLED = "false";

type ConnectedPayload = { userId: string; displayName: string };
type QueueJoinedPayload = { queuedAt: string; currentRating: number };
type MatchFoundPayload = {
  matchId: string;
  opponent: { userId: string; displayName: string; rating: number };
  bestOf: number;
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

describe("Matchmaking (e2e)", () => {
  let app: INestApplication;
  let port: number;
  let redisService: RedisService;
  let worker: MatchmakingWorkerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JWT_CONFIG)
      .useValue({ publicKey: testJwtKeys.publicKey })
      .compile();

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

  it("pairs two players and emits matchFound", async () => {
    await redisService.setex("user:rating:player-a", 60, "1000");
    await redisService.setex("user:rating:player-b", 60, "1040");

    const playerA = await connectAndJoin(port, {
      userId: "player-a",
      displayName: "Ace",
    });
    const playerB = await connectAndJoin(port, {
      userId: "player-b",
      displayName: "Bob",
    });

    const matchFoundA = waitForEvent<MatchFoundPayload>(playerA.socket, "matchFound");
    const matchFoundB = waitForEvent<MatchFoundPayload>(playerB.socket, "matchFound");

    const matches = await worker.tick();
    expect(matches).toBe(1);

    const payloadA = await matchFoundA;
    const payloadB = await matchFoundB;

    expect(payloadA.matchId).toBe(payloadB.matchId);
    expect(payloadA.bestOf).toBe(3);
    expect(payloadA.opponent).toEqual({
      userId: "player-b",
      displayName: "Bob",
      rating: 1040,
    });
    expect(payloadB.opponent).toEqual({
      userId: "player-a",
      displayName: "Ace",
      rating: 1000,
    });

    expect(await redisService.get("match:byUser:player-a")).toBe(payloadA.matchId);
    expect(await redisService.get("match:byUser:player-b")).toBe(payloadA.matchId);
    expect(await redisService.getClient().zcard("matchmaking:queue")).toBe(0);

    playerA.socket.disconnect();
    playerB.socket.disconnect();
  });

  it("rejects duplicate joinQueue with ALREADY_IN_QUEUE", async () => {
    const token = await issueTestAccessToken({ userId: "dup-user", displayName: "Dup" });
    const socket = connectClient(port, token);
    const connectedPromise = waitForEvent<ConnectedPayload>(socket, "connected");

    await new Promise<void>((resolvePromise, reject) => {
      socket.once("connect", () => resolvePromise());
      socket.once("connect_error", reject);
    });
    await connectedPromise;

    socket.emit("joinQueue", {});
    await waitForEvent<QueueJoinedPayload>(socket, "queueJoined");

    const errorPromise = waitForEvent<ErrorPayload>(socket, "error");
    socket.emit("joinQueue", {});
    const error = await errorPromise;

    expect(error.code).toBe("ALREADY_IN_QUEUE");
    socket.disconnect();
  });

  it("exposes matchmaking prometheus metrics", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("matchmaking_queue_size");
    expect(body).toContain("matchmaking_match_duration_seconds");
  });

  it("runs the worker on a 500ms interval when enabled", () => {
    expect(MATCHMAKING_WORKER_INTERVAL_MS).toBe(500);
  });
});
