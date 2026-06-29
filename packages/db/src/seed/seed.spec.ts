import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SeasonStatus, UserRole } from "@prisma/client";
import { config } from "dotenv";
import { adminUserExists, runSeed, seedAdminUser } from "./admin-user.js";
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, getSeedConfig } from "./config.js";
import { REFERENCE_LEAGUES } from "./leagues.js";
import { verifyPassword } from "./password.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
config({ path: resolve(repoRoot, ".env") });

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://app:chifoumi_dev@localhost:5432/chifoumi";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const runId = Date.now().toString();
const seedConfig = getSeedConfig({
  ...process.env,
  ADMIN_DEFAULT_EMAIL: `seed-test-${runId}@chifoumi.local`,
  ADMIN_DEFAULT_PASSWORD: DEFAULT_ADMIN_PASSWORD,
});
seedConfig.adminDisplayName = `seed_test_${runId}`;

async function cleanupSeedUser(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } });
}

describe("database seed", () => {
  beforeAll(async () => {
    await cleanupSeedUser(seedConfig.adminEmail);
  });

  afterAll(async () => {
    await cleanupSeedUser(seedConfig.adminEmail);
    await prisma.$disconnect();
  });

  it("creates admin user with Argon2id hash and EloRating from empty database", async () => {
    await runSeed(prisma, seedConfig);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: seedConfig.adminEmail },
      include: { eloRating: true },
    });

    expect(user.role).toBe(UserRole.admin);
    expect(user.displayName).toBe(seedConfig.adminDisplayName);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(user.passwordHash, seedConfig.adminPassword)).toBe(true);
    expect(user.eloRating).toEqual(
      expect.objectContaining({
        rating: 1000,
        gamesPlayed: 0,
      }),
    );

    const referenceLeagues = await prisma.league.findMany({
      where: { tier: { in: REFERENCE_LEAGUES.map((league) => league.tier) } },
      orderBy: { tier: "asc" },
    });
    const activeSeasons = await prisma.season.findMany({
      where: { status: SeasonStatus.active },
    });

    expect(referenceLeagues).toEqual(
      REFERENCE_LEAGUES.map((league) => expect.objectContaining(league)),
    );
    expect(activeSeasons).toHaveLength(1);
    expect(activeSeasons[0]?.name).toBe("Saison 1");
  });

  it("is idempotent when run on an existing database", async () => {
    await seedAdminUser(prisma, seedConfig);
    await runSeed(prisma, seedConfig);

    const beforeCount = await prisma.user.count({ where: { email: seedConfig.adminEmail } });
    const beforeLeagueCount = await prisma.league.count();
    const beforeActiveSeasonCount = await prisma.season.count({
      where: { status: SeasonStatus.active },
    });

    await runSeed(prisma, seedConfig);

    const afterCount = await prisma.user.count({ where: { email: seedConfig.adminEmail } });
    const afterLeagueCount = await prisma.league.count();
    const afterActiveSeasonCount = await prisma.season.count({
      where: { status: SeasonStatus.active },
    });

    expect(beforeCount).toBe(1);
    expect(afterCount).toBe(1);
    expect(afterLeagueCount).toBe(beforeLeagueCount);
    expect(afterActiveSeasonCount).toBe(beforeActiveSeasonCount);
    expect(await adminUserExists(prisma, seedConfig.adminEmail)).toBe(true);
  });

  it("uses documented default credentials when env vars are unset", () => {
    const defaults = getSeedConfig({});
    expect(defaults.adminEmail).toBe(DEFAULT_ADMIN_EMAIL);
    expect(defaults.adminPassword).toBe(DEFAULT_ADMIN_PASSWORD);
  });
});
