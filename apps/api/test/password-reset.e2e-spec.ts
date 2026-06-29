import { createHash, generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { NotificationsQueueService } from "../../auth-service/src/queues/notifications-queue.service.js";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import {
  type InternalServicesHandle,
  startInternalAuthUserServices,
} from "./helpers/internal-services.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

const jwtKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
process.env.DATABASE_URL ??= "postgresql://app:chifoumi_dev@localhost:5432/chifoumi";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_PRIVATE_KEY_PATH = resolve(
  repoRoot,
  process.env.JWT_PRIVATE_KEY_PATH ?? "infra/keys/jwt-private.pem",
);
process.env.JWT_PUBLIC_KEY_PATH = resolve(
  repoRoot,
  process.env.JWT_PUBLIC_KEY_PATH ?? "infra/keys/jwt-public.pem",
);
process.env.FRONTEND_URL ??= "http://localhost:5173";

type EnqueuedMail = {
  template: string;
  to: string;
  data: Record<string, string>;
};

class NotificationsQueueMock {
  readonly enqueued: EnqueuedMail[] = [];

  async enqueueWelcomeMail(input: { to: string; displayName: string }): Promise<void> {
    this.enqueued.push({
      template: "welcome",
      to: input.to,
      data: { displayName: input.displayName },
    });
  }

  async enqueuePasswordResetMail(input: { to: string; resetUrl: string }): Promise<void> {
    this.enqueued.push({
      template: "reset-password",
      to: input.to,
      data: { resetUrl: input.resetUrl },
    });
  }

  async enqueueSendMail(payload: {
    to: string;
    template: string;
    data: Record<string, string>;
  }): Promise<void> {
    this.enqueued.push(payload);
  }
}

describe("Password reset (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queueMock: NotificationsQueueMock;
  let internalServices: InternalServicesHandle;

  beforeAll(async () => {
    queueMock = new NotificationsQueueMock();
    internalServices = await startInternalAuthUserServices({
      authProviderOverrides: [{ token: NotificationsQueueService, value: queueMock }],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.eloHistory.deleteMany();
    await prisma.round.deleteMany();
    await prisma.match.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.eloRating.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (internalServices) {
      await internalServices.close();
    }
  });

  beforeEach(() => {
    queueMock.enqueued.length = 0;
  });

  async function registerUser(email: string, password = "password1234"): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email,
        password,
        displayName: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      .expect(201);
    return res.body.user.id;
  }

  it("POST /auth/forgot-password → 200 and enqueues reset mail for known email", async () => {
    const email = `forgot-${Date.now()}@example.com`;
    await registerUser(email);
    queueMock.enqueued.length = 0;

    await request(app.getHttpServer()).post("/auth/forgot-password").send({ email }).expect(200);

    const resetJobs = queueMock.enqueued.filter((job) => job.template === "reset-password");
    expect(resetJobs).toHaveLength(1);
    expect(resetJobs[0]?.to).toBe(email);
    expect(resetJobs[0]?.data.resetUrl).toContain(
      `${process.env.FRONTEND_URL}/reset-password?token=`,
    );

    const tokens = await prisma.passwordResetToken.findMany({
      where: { user: { email } },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.tokenHash).not.toMatch(/^[0-9a-f-]{36}$/);
    const expiresInMs = (tokens[0]?.expiresAt.getTime() ?? 0) - Date.now();
    expect(expiresInMs).toBeGreaterThan(50 * 60 * 1000);
    expect(expiresInMs).toBeLessThanOrEqual(60 * 60 * 1000 + 1_000);
  });

  it("POST /auth/forgot-password → 200 silently when email is unknown (anti-enumeration)", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ email: `unknown-${Date.now()}@example.com` })
      .expect(200);

    const resetJobs = queueMock.enqueued.filter((job) => job.template === "reset-password");
    expect(resetJobs).toHaveLength(0);
  });

  it("nominal flow: forgot then reset updates password and revokes refresh tokens", async () => {
    const email = `reset-${Date.now()}@example.com`;
    const userId = await registerUser(email, "password1234");

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "password1234" })
      .expect(200);
    const oldRefresh = loginRes.body.tokens.refresh as string;

    queueMock.enqueued.length = 0;
    await request(app.getHttpServer()).post("/auth/forgot-password").send({ email }).expect(200);

    const resetUrl = queueMock.enqueued.find((job) => job.template === "reset-password")?.data
      .resetUrl;
    expect(resetUrl).toBeDefined();
    const token = new URL(resetUrl ?? "").searchParams.get("token");
    expect(token).toBeTruthy();
    if (!token) throw new Error("Missing reset token");

    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token, newPassword: "newPassword4567" })
      .expect(204);

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.passwordHash).toMatch(/^\$argon2id\$/);

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const storedToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    expect(storedToken?.usedAt).not.toBeNull();

    const activeRefreshTokens = await prisma.refreshToken.count({
      where: { userId, revokedAt: null },
    });
    expect(activeRefreshTokens).toBe(0);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: oldRefresh })
      .expect(401);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "password1234" })
      .expect(401);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "newPassword4567" })
      .expect(200);
  });

  it("POST /auth/reset-password → 401 when token has already been used", async () => {
    const email = `reused-${Date.now()}@example.com`;
    await registerUser(email);

    queueMock.enqueued.length = 0;
    await request(app.getHttpServer()).post("/auth/forgot-password").send({ email }).expect(200);

    const resetUrl = queueMock.enqueued.find((job) => job.template === "reset-password")?.data
      .resetUrl;
    const token = new URL(resetUrl ?? "").searchParams.get("token");
    if (!token) throw new Error("Missing reset token");

    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token, newPassword: "newPassword4567" })
      .expect(204);

    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token, newPassword: "anotherPassword99" })
      .expect(401);
  });

  it("POST /auth/reset-password → 401 when token has expired", async () => {
    const email = `expired-${Date.now()}@example.com`;
    await registerUser(email);

    queueMock.enqueued.length = 0;
    await request(app.getHttpServer()).post("/auth/forgot-password").send({ email }).expect(200);

    const resetUrl = queueMock.enqueued.find((job) => job.template === "reset-password")?.data
      .resetUrl;
    const token = new URL(resetUrl ?? "").searchParams.get("token");
    if (!token) throw new Error("Missing reset token");

    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date("2020-01-01") },
    });

    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token, newPassword: "newPassword4567" })
      .expect(401);
  });

  it("POST /auth/reset-password → 401 for unknown token", async () => {
    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({
        token: "00000000-0000-4000-8000-000000000000",
        newPassword: "newPassword4567",
      })
      .expect(401);
  });
});
