import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { MatchStatus, RoundWinner } from "@chifoumi/db";
import { computeCommitHash } from "@chifoumi/schemas";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
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

describe("GET /matches/:id/audit rate limiting (e2e)", () => {
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
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.eloHistory.deleteMany();
      await prisma.round.deleteMany();
      await prisma.match.deleteMany();
      await prisma.refreshToken.deleteMany();
      await prisma.eloRating.deleteMany();
      await prisma.user.deleteMany();
    }
    if (app) {
      await app.close();
    }
  }, 30_000);

  it("returns 429 after 10 requests per minute per IP", async () => {
    const playerAId = randomUUID();
    const playerBId = randomUUID();
    const matchId = randomUUID();
    const nonceA = createHash("sha256").update("nonce-a").digest("hex").slice(0, 32);
    const nonceB = createHash("sha256").update("nonce-b").digest("hex").slice(0, 32);
    const moveA = "rock";
    const moveB = "paper";

    await prisma.user.createMany({
      data: [
        {
          id: playerAId,
          email: `player-a-${Date.now()}@example.com`,
          passwordHash: "hash",
          displayName: "Alice",
        },
        {
          id: playerBId,
          email: `player-b-${Date.now()}@example.com`,
          passwordHash: "hash",
          displayName: "Bob",
        },
      ],
    });

    await prisma.match.create({
      data: {
        id: matchId,
        playerAId,
        playerBId,
        winnerId: playerBId,
        scoreA: 0,
        scoreB: 2,
        startedAt: new Date(Date.now() - 120_000),
        endedAt: new Date(Date.now() - 60_000),
        status: MatchStatus.ended,
        rounds: {
          create: [
            {
              roundNumber: 1,
              moveA,
              moveB,
              commitA: computeCommitHash(moveA, nonceA),
              commitB: computeCommitHash(moveB, nonceB),
              nonceA,
              nonceB,
              winner: RoundWinner.b,
              resolvedAt: new Date(Date.now() - 90_000),
            },
          ],
        },
      },
    });

    const url = `/matches/${matchId}/audit`;

    for (let i = 0; i < 10; i += 1) {
      await request(app.getHttpServer()).get(url).expect(200);
    }

    await request(app.getHttpServer()).get(url).expect(429);
  });
});
