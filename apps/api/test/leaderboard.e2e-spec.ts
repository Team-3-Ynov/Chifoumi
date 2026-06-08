import { generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import { Redis } from "ioredis";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { LEADERBOARD_INVALIDATE_CHANNEL } from "../src/redis/redis.service.js";

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

describe("GET /leaderboard (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisPublisher: Redis;

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
    redisPublisher = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  }, 30_000);

  beforeEach(async () => {
    const keys = await redisPublisher.keys("leaderboard:top:*");
    if (keys.length > 0) {
      await redisPublisher.del(...keys);
    }

    await prisma.eloHistory.deleteMany();
    await prisma.round.deleteMany();
    await prisma.match.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.eloRating.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await redisPublisher?.quit();
    if (app) {
      await app.close();
    }
  }, 30_000);

  async function seedPlayer(displayName: string, rating: number, gamesPlayed: number) {
    const user = await prisma.user.create({
      data: {
        email: `${displayName}-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: "hash",
        displayName,
        eloRating: {
          create: { rating, gamesPlayed },
        },
      },
    });
    return user;
  }

  it("returns top players sorted by rating then gamesPlayed without authentication", async () => {
    await seedPlayer("low", 900, 100);
    await seedPlayer("top", 1600, 10);
    await seedPlayer("tie-rating-a", 1500, 30);
    await seedPlayer("tie-rating-b", 1500, 50);

    const res = await request(app.getHttpServer()).get("/leaderboard?limit=3").expect(200);

    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0]).toMatchObject({
      rank: 1,
      displayName: "top",
      rating: 1600,
      gamesPlayed: 10,
    });
    expect(res.body.items[1]).toMatchObject({
      rank: 2,
      displayName: "tie-rating-b",
      rating: 1500,
      gamesPlayed: 50,
    });
    expect(res.body.items[2]).toMatchObject({
      rank: 3,
      displayName: "tie-rating-a",
      rating: 1500,
      gamesPlayed: 30,
    });
  });

  it("serves subsequent requests from Redis cache", async () => {
    await seedPlayer("cached", 1200, 5);

    const first = await request(app.getHttpServer()).get("/leaderboard?limit=10").expect(200);
    const second = await request(app.getHttpServer()).get("/leaderboard?limit=10").expect(200);

    expect(first.headers["x-cache"]).toBe("MISS");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body).toEqual(first.body);
  });

  it("recalculates after leaderboard invalidation event", async () => {
    const player = await seedPlayer("before", 1100, 2);

    await request(app.getHttpServer()).get("/leaderboard?limit=10").expect(200);

    await prisma.eloRating.update({
      where: { userId: player.id },
      data: { rating: 1800, gamesPlayed: 2 },
    });

    const cached = await request(app.getHttpServer()).get("/leaderboard?limit=10").expect(200);
    expect(cached.headers["x-cache"]).toBe("HIT");
    expect(cached.body.items[0].rating).toBe(1100);

    await redisPublisher.publish(LEADERBOARD_INVALIDATE_CHANNEL, "*");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));

    const refreshed = await request(app.getHttpServer()).get("/leaderboard?limit=10").expect(200);
    expect(refreshed.headers["x-cache"]).toBe("MISS");
    expect(refreshed.body.items[0]).toMatchObject({
      displayName: "before",
      rating: 1800,
    });
  });

  it("rejects limit above 100", async () => {
    const res = await request(app.getHttpServer()).get("/leaderboard?limit=101").expect(400);

    expect(res.body.message).toContain("limit must be ≤ 100");
  });
});
