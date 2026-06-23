import { generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

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

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
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
    await prisma.refreshToken.deleteMany();
    await prisma.eloRating.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("POST /auth/register → 201, login → 200, GET /me → 200/401", async () => {
    const email = `user-${Date.now()}@example.com`;

    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email,
        password: "password1234",
        displayName: "player1",
      })
      .expect(201);

    expect(registerRes.body.user.role).toBe("player");
    expect(registerRes.body.tokens.access).toBeDefined();
    expect(registerRes.body.tokens.refresh).toBeDefined();

    const userRow = await prisma.user.findUnique({ where: { email } });
    expect(userRow?.passwordHash).toMatch(/^\$argon2id\$/);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "password1234" })
      .expect(200);

    const access = loginRes.body.tokens.access as string;

    await request(app.getHttpServer()).get("/me").expect(401);

    const meRes = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${access}`)
      .expect(200);

    expect(meRes.body).toEqual({
      id: expect.any(String),
      email,
      displayName: "player1",
      role: "player",
      rating: 1000,
      gamesPlayed: 0,
      league: { name: "Bronze", tier: 1 },
      createdAt: expect.any(String),
    });

    const publicProfileRes = await request(app.getHttpServer())
      .get(`/users/${registerRes.body.user.id}/profile`)
      .set("Authorization", `Bearer ${access}`)
      .expect(200);

    expect(publicProfileRes.body).toEqual({
      id: registerRes.body.user.id,
      displayName: "player1",
      rating: 1000,
      gamesPlayed: 0,
      league: { name: "Bronze", tier: 1 },
      winRate: 0,
      createdAt: expect.any(String),
    });
    expect(publicProfileRes.body.email).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/users/${registerRes.body.user.id}/profile`)
      .expect(401);

    const missingProfileRes = await request(app.getHttpServer())
      .get("/users/00000000-0000-4000-8000-000000000000/profile")
      .set("Authorization", `Bearer ${access}`)
      .expect(404);

    expect(missingProfileRes.body).toEqual({ error: "USER_NOT_FOUND" });

    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${access}`)
      .expect(204);

    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${access}`)
      .expect(401);

    await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${access}`)
      .expect(401);

    const activeRefreshTokens = await prisma.refreshToken.count({
      where: {
        userId: registerRes.body.user.id,
        revokedAt: null,
      },
    });
    expect(activeRefreshTokens).toBe(0);
  });

  it("POST /auth/refresh → 401 for unknown and expired tokens", async () => {
    const unknownToken = "a".repeat(43);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: unknownToken })
      .expect(401);

    const email = `expired-${Date.now()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password1234", displayName: "expired-user" })
      .expect(201);

    const refreshToken = registerRes.body.tokens.refresh as string;
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    if (!user) {
      throw new Error("Expected registered user");
    }

    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, tokenHash },
      data: { expiresAt: new Date("2020-01-01") },
    });

    await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(401);
  });

  it("duplicate register → 409 with generic message", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password1234", displayName: "dupuser" })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password1234", displayName: "dupuser2" })
      .expect(409);

    expect(res.body.message).toBe("Unable to complete registration");
  });

  it("POST /auth/refresh rotates tokens, handles concurrent requests, and rejects reuse", async () => {
    const email = `refresh-${Date.now()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password1234", displayName: "refresh-user" })
      .expect(201);

    const initialRefresh = registerRes.body.tokens.refresh as string;

    const [firstRes, secondRes] = await Promise.all([
      request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken: initialRefresh }),
      request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken: initialRefresh }),
    ]);

    const statuses = [firstRes.status, secondRes.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 401]);

    const refreshRes = firstRes.status === 200 ? firstRes : secondRes;

    expect(refreshRes.body.tokens.access).toBeDefined();
    expect(refreshRes.body.tokens.refresh).toBeDefined();
    expect(refreshRes.body.tokens.refresh).not.toBe(initialRefresh);

    await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${refreshRes.body.tokens.access}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: initialRefresh })
      .expect(401);

    const activeRefreshTokens = await prisma.refreshToken.count({
      where: {
        userId: registerRes.body.user.id,
        revokedAt: null,
      },
    });
    expect(activeRefreshTokens).toBe(0);
  });
});
