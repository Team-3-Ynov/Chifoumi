import { getLeagueForRating } from "./getLeagueForRating.js";
import type { LeagueSummary, ReferenceLeague } from "./types.js";

export const REFERENCE_LEAGUES = [
  { name: "Bronze", tier: 1, minRating: 0, maxRating: 1099 },
  { name: "Silver", tier: 2, minRating: 1100, maxRating: 1199 },
  { name: "Gold", tier: 3, minRating: 1200, maxRating: 1349 },
  { name: "Platinum", tier: 4, minRating: 1350, maxRating: null },
] as const satisfies readonly ReferenceLeague[];

export function getReferenceLeagueByName(name: string): ReferenceLeague | null {
  const normalizedName = name.trim().toLowerCase();
  return REFERENCE_LEAGUES.find((league) => league.name.toLowerCase() === normalizedName) ?? null;
}

export function getLeagueSummaryForRating(rating: number): LeagueSummary {
  const league = getLeagueForRating(rating, REFERENCE_LEAGUES);
  return toLeagueSummary(league);
}

export function toLeagueSummary(league: ReferenceLeague): LeagueSummary {
  return {
    name: league.name,
    tier: league.tier,
  };
}
