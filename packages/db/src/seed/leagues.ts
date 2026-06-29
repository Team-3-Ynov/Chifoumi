import { REFERENCE_LEAGUES } from "@chifoumi/leagues";
import { type PrismaClient, SeasonStatus } from "@prisma/client";

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;
export { REFERENCE_LEAGUES };

export async function seedLeaguesAndActiveSeason(
  prisma: PrismaClient,
  now = new Date(),
): Promise<void> {
  assertContiguousLeagues(REFERENCE_LEAGUES);

  for (const league of REFERENCE_LEAGUES) {
    await prisma.league.upsert({
      where: { tier: league.tier },
      create: league,
      update: {
        name: league.name,
        minRating: league.minRating,
        maxRating: league.maxRating,
      },
    });
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: SeasonStatus.active },
    select: { id: true },
  });

  if (activeSeason) {
    return;
  }

  await prisma.season.create({
    data: {
      name: "Saison 1",
      startedAt: now,
      endsAt: new Date(now.getTime() + THIRTY_DAYS_IN_MS),
      status: SeasonStatus.active,
    },
  });
}

function assertContiguousLeagues(
  leagues: readonly { tier: number; minRating: number; maxRating: number | null }[],
): void {
  const sorted = [...leagues].sort((leagueA, leagueB) => leagueA.tier - leagueB.tier);

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];

    if (
      !current ||
      !next ||
      current.maxRating === null ||
      current.maxRating + 1 !== next.minRating
    ) {
      throw new Error("Reference leagues must be contiguous");
    }
  }
}
