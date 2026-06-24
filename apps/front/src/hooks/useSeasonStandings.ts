import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { SeasonStandingsResponse } from "../api/types.js";
import type { LeagueFilter } from "../leagues/leagueFilters.js";

export const SEASON_STANDINGS_LIMIT = 50;

export function buildSeasonStandingsPath(
  seasonId: string,
  page = 1,
  league?: LeagueFilter,
): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(SEASON_STANDINGS_LIMIT),
  });
  if (league) {
    params.set("league", league);
  }

  return `/seasons/${seasonId}/standings?${params.toString()}`;
}

export function useSeasonStandings(
  seasonId: string | undefined,
  page: number,
  league?: LeagueFilter,
) {
  return useQuery({
    queryKey: ["season-standings", seasonId, SEASON_STANDINGS_LIMIT, page, league ?? "all"],
    enabled: Boolean(seasonId),
    queryFn: async () => {
      if (!seasonId) {
        throw new Error("Missing season id");
      }

      return apiRequest<SeasonStandingsResponse>(buildSeasonStandingsPath(seasonId, page, league));
    },
  });
}
