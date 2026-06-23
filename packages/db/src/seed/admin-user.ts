import { type PrismaClient, UserRole } from "@prisma/client";
import { getSeedConfig, type SeedConfig } from "./config.js";
import { seedLeaguesAndActiveSeason } from "./leagues.js";
import { hashPassword } from "./password.js";

const DEFAULT_ELO_RATING = 1000;

export async function adminUserExists(prisma: PrismaClient, adminEmail: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, role: true },
  });

  return user?.role === UserRole.admin;
}

export async function seedAdminUser(
  prisma: PrismaClient,
  config: SeedConfig = getSeedConfig(),
): Promise<void> {
  const passwordHash = await hashPassword(config.adminPassword);

  const user = await prisma.user.upsert({
    where: { email: config.adminEmail },
    create: {
      email: config.adminEmail,
      displayName: config.adminDisplayName,
      passwordHash,
      role: UserRole.admin,
    },
    update: {
      role: UserRole.admin,
    },
  });

  await prisma.eloRating.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      rating: DEFAULT_ELO_RATING,
      gamesPlayed: 0,
    },
    update: {},
  });
}

export async function runSeed(
  prisma: PrismaClient,
  config: SeedConfig = getSeedConfig(),
): Promise<void> {
  await seedLeaguesAndActiveSeason(prisma);

  // TODO sprint 4: seed default skins reference data

  if (await adminUserExists(prisma, config.adminEmail)) {
    console.log(`Admin user ${config.adminEmail} already exists, skipping seed.`);
    return;
  }

  await seedAdminUser(prisma, config);
  console.log(`Seeded admin user ${config.adminEmail}.`);
}
