import { generateKeyPairSync, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { MatchStatus } from "@chifoumi/db";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import {
  type InternalServicesHandle,
  startInternalAuthUserServices,
} from "./helpers/internal-services.js";

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

describe("GET /me/history (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let internalServices: InternalServicesHandle;

  beforeEach(async () => {
    internalServices = await startInternalAuthUserServices();

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

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (internalServices) {
      await internalServices.close();
    }
  });

  async function registerAndLogin(displayName: string) {
    const email = `${displayName}-${Date.now()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email,
        password: "password1234",
        displayName,
      })
      .expect(201);

    return {
      userId: registerRes.body.user.id as string,
      access: registerRes.body.tokens.access as string,
    };
  }

  async function seedEndedMatch(params: {
    playerAId: string;
    playerBId: string;
    winnerId: string;
    scoreA: number;
    scoreB: number;
    endedAt: Date;
    playerADelta: number;
    playerBDelta: number;
  }) {
    const matchId = randomUUID();
    await prisma.match.create({
      data: {
        id: matchId,
        playerAId: params.playerAId,
        playerBId: params.playerBId,
        winnerId: params.winnerId,
        scoreA: params.scoreA,
        scoreB: params.scoreB,
        startedAt: new Date(params.endedAt.getTime() - 60_000),
        endedAt: params.endedAt,
        status: MatchStatus.ended,
        eloHistory: {
          create: [
            {
              userId: params.playerAId,
              ratingBefore: 1000,
              ratingAfter: 1000 + params.playerADelta,
              delta: params.playerADelta,
            },
            {
              userId: params.playerBId,
              ratingBefore: 1040,
              ratingAfter: 1040 + params.playerBDelta,
              delta: params.playerBDelta,
            },
          ],
        },
      },
    });
    return matchId;
  }

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/me/history").expect(401);
  });

  it("returns empty history for a user without matches", async () => {
    const { access } = await registerAndLogin("solo");

    const res = await request(app.getHttpServer())
      .get("/me/history")
      .set("Authorization", `Bearer ${access}`)
      .expect(200);

    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it("rejects limit above 100", async () => {
    const { access } = await registerAndLogin("limit");

    const res = await request(app.getHttpServer())
      .get("/me/history?limit=101")
      .set("Authorization", `Bearer ${access}`)
      .expect(400);

    expect(res.body.message).toContain("limit must be ≤ 100");
  });

  it("paginates 50 matches with stable cursor pages", async () => {
    const playerA = await registerAndLogin("alice");
    const playerB = await registerAndLogin("bob");

    const matchIds: string[] = [];
    for (let i = 0; i < 50; i += 1) {
      const endedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, 50 - i));
      const matchId = await seedEndedMatch({
        playerAId: playerA.userId,
        playerBId: playerB.userId,
        winnerId: playerA.userId,
        scoreA: 2,
        scoreB: 1,
        endedAt,
        playerADelta: 10,
        playerBDelta: -10,
      });
      matchIds.push(matchId);
    }

    const firstPage = await request(app.getHttpServer())
      .get("/me/history?limit=20")
      .set("Authorization", `Bearer ${playerA.access}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(20);
    expect(firstPage.body.nextCursor).toBeTruthy();
    expect(firstPage.body.items[0].matchId).toBe(matchIds[0]);
    expect(firstPage.body.items[0]).toMatchObject({
      opponent: { displayName: "bob", ratingAtMatch: 1040 },
      scoreA: 2,
      scoreB: 1,
      isWinner: true,
      eloDelta: 10,
    });

    const secondPage = await request(app.getHttpServer())
      .get(`/me/history?limit=20&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set("Authorization", `Bearer ${playerA.access}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(20);
    expect(secondPage.body.nextCursor).toBeTruthy();

    const firstIds = firstPage.body.items.map((item: { matchId: string }) => item.matchId);
    const secondIds = secondPage.body.items.map((item: { matchId: string }) => item.matchId);
    const overlap = firstIds.filter((id: string) => secondIds.includes(id));
    expect(overlap).toHaveLength(0);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(40);

    const thirdPage = await request(app.getHttpServer())
      .get(`/me/history?limit=20&cursor=${encodeURIComponent(secondPage.body.nextCursor)}`)
      .set("Authorization", `Bearer ${playerA.access}`)
      .expect(200);

    expect(thirdPage.body.items).toHaveLength(10);
    expect(thirdPage.body.nextCursor).toBeNull();
  });
});
