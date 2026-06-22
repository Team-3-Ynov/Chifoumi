import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { MatchStatus, RoundWinner } from "@chifoumi/db";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { computeCommitHash } from "../src/matches/commit-hash.js";
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

describe("GET /matches/:id/audit (e2e)", () => {
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

  beforeEach(async () => {
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
  }, 30_000);

  async function seedUsers() {
    const playerAId = randomUUID();
    const playerBId = randomUUID();

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

    return { playerAId, playerBId };
  }

  async function seedEndedMatchWithRounds(params: {
    playerAId: string;
    playerBId: string;
    tamperPlayerA?: boolean;
  }) {
    const matchId = randomUUID();
    const nonceA = createHash("sha256").update("nonce-a").digest("hex").slice(0, 32);
    const nonceB = createHash("sha256").update("nonce-b").digest("hex").slice(0, 32);
    const moveA = params.tamperPlayerA ? "paper" : "rock";
    const moveB = "paper";
    const commitA = computeCommitHash(params.tamperPlayerA ? "rock" : moveA, nonceA);
    const commitB = computeCommitHash(moveB, nonceB);

    await prisma.match.create({
      data: {
        id: matchId,
        playerAId: params.playerAId,
        playerBId: params.playerBId,
        winnerId: params.playerBId,
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
              commitA,
              commitB,
              nonceA,
              nonceB,
              winner: RoundWinner.b,
              resolvedAt: new Date(Date.now() - 90_000),
            },
          ],
        },
      },
    });

    return {
      matchId,
      nonceA,
      nonceB,
      moveA,
      moveB,
      commitA,
      commitB,
    };
  }

  it("returns audit trail for an ended match without auth", async () => {
    const { playerAId, playerBId } = await seedUsers();
    const seeded = await seedEndedMatchWithRounds({ playerAId, playerBId });

    const res = await request(app.getHttpServer())
      .get(`/matches/${seeded.matchId}/audit`)
      .expect(200);

    expect(res.body).toEqual({
      matchId: seeded.matchId,
      players: [playerAId, playerBId],
      rounds: [
        {
          roundNumber: 1,
          commitA: seeded.commitA,
          commitB: seeded.commitB,
          moveA: seeded.moveA,
          moveB: seeded.moveB,
          nonceA: seeded.nonceA,
          nonceB: seeded.nonceB,
          hashCheck: { a: "match", b: "match" },
        },
      ],
      finalScore: { a: 0, b: 2 },
      winner: playerBId,
    });
  });

  it("returns 403 for an in-progress match", async () => {
    const { playerAId, playerBId } = await seedUsers();
    const matchId = randomUUID();

    await prisma.match.create({
      data: {
        id: matchId,
        playerAId,
        playerBId,
        scoreA: 0,
        scoreB: 0,
        startedAt: new Date(),
        status: MatchStatus.in_progress,
      },
    });

    const res = await request(app.getHttpServer()).get(`/matches/${matchId}/audit`).expect(403);

    expect(res.body).toEqual({ error: "MATCH_NOT_ENDED" });
  });

  it("returns 404 for an unknown match", async () => {
    await request(app.getHttpServer()).get(`/matches/${randomUUID()}/audit`).expect(404);
  });

  it("reports hash mismatch when stored commit does not match reveal", async () => {
    const { playerAId, playerBId } = await seedUsers();
    const seeded = await seedEndedMatchWithRounds({
      playerAId,
      playerBId,
      tamperPlayerA: true,
    });

    const res = await request(app.getHttpServer())
      .get(`/matches/${seeded.matchId}/audit`)
      .expect(200);

    expect(res.body.rounds[0].hashCheck).toEqual({ a: "mismatch", b: "match" });
  });
});
