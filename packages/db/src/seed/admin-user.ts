import { type PrismaClient, TournamentFormat, TournamentStatus, UserRole } from "@prisma/client";
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

async function seedDemoTournament(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.tournament.findFirst({
    where: { name: "Tournoi de démonstration" },
    select: { id: true },
  });
  if (existing) return;

  const now = new Date();
  const registrationOpensAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const startsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.tournament.create({
    data: {
      name: "Tournoi de démonstration",
      format: TournamentFormat.single_elim,
      bracketSize: 8,
      registrationOpensAt,
      startsAt,
      status: TournamentStatus.upcoming,
    },
  });
  console.log("Seeded demo tournament.");
}

export async function runSeed(
  prisma: PrismaClient,
  config: SeedConfig = getSeedConfig(),
): Promise<void> {
  await seedLeaguesAndActiveSeason(prisma);
  await seedDemoTournament(prisma);

  if (await adminUserExists(prisma, config.adminEmail)) {
    console.log(`Admin user ${config.adminEmail} already exists, skipping seed.`);
    return;
  }

  await seedAdminUser(prisma, config);
  console.log(`Seeded admin user ${config.adminEmail}.`);
}
