import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { LeaderboardResponse } from "../api/types.js";

const LEADERBOARD_LIMIT = 50;
const LEADERBOARD_REFRESH_MS = 30_000;

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard", LEADERBOARD_LIMIT],
    queryFn: () => apiRequest<LeaderboardResponse>(`/leaderboard?limit=${LEADERBOARD_LIMIT}`),
    refetchInterval: LEADERBOARD_REFRESH_MS,
    refetchIntervalInBackground: true,
  });
}
