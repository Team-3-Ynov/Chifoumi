import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { MatchStatus, PrismaClient } from "@prisma/client";

const MATCH_COUNT = Number.parseInt(process.env.BENCH_MATCH_COUNT ?? "10000", 10);
const USER_COUNT = Number.parseInt(process.env.BENCH_USER_COUNT ?? "200", 10);
const BATCH_SIZE = 500;
const RUN_ID = process.env.BENCH_RUN_ID ?? Date.now().toString(36);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickTwoDistinct<T>(items: T[]): [T, T] {
  const firstIndex = randomInt(0, items.length - 1);
  let secondIndex = randomInt(0, items.length - 1);
  while (secondIndex === firstIndex) {
    secondIndex = randomInt(0, items.length - 1);
  }
  return [items[firstIndex], items[secondIndex]];
}

async function seedUsers(): Promise<string[]> {
  const userIds: string[] = [];

  for (let index = 0; index < USER_COUNT; index += 1) {
    const suffix = String(index).padStart(5, "0");
    const user = await prisma.user.create({
      data: {
        email: `bench-${RUN_ID}-${suffix}@chifoumi.local`,
        displayName: `bench_${RUN_ID}_${suffix}`,
        passwordHash: "bench",
        eloRating: {
          create: {
            rating: randomInt(800, 2200),
            gamesPlayed: 0,
          },
        },
      },
      select: { id: true },
    });
    userIds.push(user.id);
  }

  return userIds;
}

async function seedMatches(userIds: string[]): Promise<void> {
  for (let offset = 0; offset < MATCH_COUNT; offset += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, MATCH_COUNT - offset);
    const matches = Array.from({ length: batchSize }, () => {
      const [playerAId, playerBId] = pickTwoDistinct(userIds);
      const scoreA = randomInt(0, 2);
      const scoreB = randomInt(0, 2);
      const winnerId = scoreA === scoreB ? null : scoreA > scoreB ? playerAId : playerBId;
      const endedAt = new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000));

      return {
        id: randomUUID(),
        playerAId,
        playerBId,
        winnerId,
        scoreA,
        scoreB,
        startedAt: new Date(endedAt.getTime() - randomInt(60_000, 600_000)),
        endedAt,
        status: MatchStatus.ended,
      };
    });

    await prisma.match.createMany({ data: matches });
  }

  await prisma.$executeRaw`
    UPDATE elo_ratings er
    SET games_played = sub.games_played
    FROM (
      SELECT user_id, COUNT(*)::int AS games_played
      FROM (
        SELECT player_a_id AS user_id FROM matches WHERE status = 'ended'
        UNION ALL
        SELECT player_b_id AS user_id FROM matches WHERE status = 'ended'
      ) AS participations
      GROUP BY user_id
    ) AS sub
    WHERE er.user_id = sub.user_id
  `;
}

async function main(): Promise<void> {
  console.warn(
    "seed:bench inserts benchmark data without cleanup. Use only on local/dev databases.",
  );
  console.log(`Seeding ${USER_COUNT} users and ${MATCH_COUNT} ended matches...`);
  const userIds = await seedUsers();
  await seedMatches(userIds);
  console.log("Benchmark dataset ready.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
