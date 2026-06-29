import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { LeaderboardResponse } from "../api/types.js";
import type { LeagueFilter } from "../leagues/leagueFilters.js";

const LEADERBOARD_LIMIT = 50;
const LEADERBOARD_REFRESH_MS = 30_000;

export type LeaderboardLeagueFilter = LeagueFilter;

export function buildLeaderboardPath(league?: LeaderboardLeagueFilter): string {
  const params = new URLSearchParams({ limit: String(LEADERBOARD_LIMIT) });
  if (league) {
    params.set("league", league);
  }

  return `/leaderboard?${params.toString()}`;
}

export function useLeaderboard(league?: LeaderboardLeagueFilter) {
  return useQuery({
    queryKey: ["leaderboard", LEADERBOARD_LIMIT, league ?? "all"],
    queryFn: () => apiRequest<LeaderboardResponse>(buildLeaderboardPath(league)),
    refetchInterval: LEADERBOARD_REFRESH_MS,
    refetchIntervalInBackground: true,
  });
}
