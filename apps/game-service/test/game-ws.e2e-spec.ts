import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module.js";
import { JWT_CONFIG } from "../src/config/jwt.config.js";
import { RedisService } from "../src/redis/redis.service.js";
import { issueTestAccessToken, testJwtKeys } from "../src/testing/issue-test-access-token.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

process.env.JWT_PUBLIC_KEY = testJwtKeys.publicKey;
process.env.REDIS_URL ??= "redis://localhost:6379";

type ConnectedPayload = { userId: string; displayName: string };

function connectClient(port: number, token?: string): Socket {
  return io(`http://127.0.0.1:${port}/game`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    query: token ? { token } : {},
  });
}

function waitForConnectError(socket: Socket): Promise<Error & { data?: { code?: number } }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connect_error timeout")), 5_000);
    socket.on("connect", () => {
      clearTimeout(timeout);
      reject(new Error("expected connect_error but socket connected"));
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timeout);
      resolve(error as Error & { data?: { code?: number } });
    });
  });
}

function waitForConnected(socket: Socket): Promise<ConnectedPayload> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connected timeout")), 10_000);
    socket.once("connected", (payload: ConnectedPayload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

describe("Game WS auth (e2e)", () => {
  let app: INestApplication;
  let port: number;
  let redisService: RedisService;

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("accepts a valid JWT and emits connected", async () => {
    const token = await issueTestAccessToken({
      userId: "user-valid",
      displayName: "Ace",
    });
    const socket = connectClient(port, token);
    const connectedPromise = waitForConnected(socket);

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    const payload = await connectedPromise;
    expect(payload).toEqual({ userId: "user-valid", displayName: "Ace" });

    const mappedSocketId = await redisService.getUserSocket("user-valid");
    expect(mappedSocketId).toBe(socket.id);

    socket.disconnect();
  });

  it("rejects connections without a token", async () => {
    const socket = connectClient(port);
    const error = await waitForConnectError(socket);
    expect(error.message).toBe("INVALID_TOKEN");
    expect(error.data?.code).toBe(4001);
    socket.disconnect();
  });

  it("rejects expired tokens", async () => {
    const token = await issueTestAccessToken({ expiresIn: -1 });
    const socket = connectClient(port, token);
    const error = await waitForConnectError(socket);
    expect(error.message).toBe("INVALID_TOKEN");
    expect(error.data?.code).toBe(4001);
    socket.disconnect();
  });

  it("rejects blacklisted tokens", async () => {
    const jti = "revoked-jti";
    const token = await issueTestAccessToken({ jti });
    await redisService.revokeAccessToken(jti, 60);

    const socket = connectClient(port, token);
    const error = await waitForConnectError(socket);
    expect(error.message).toBe("TOKEN_REVOKED");
    expect(error.data?.code).toBe(4003);
    socket.disconnect();
  });
});
