import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { CurrentSeasonResponse } from "../api/types.js";

const CURRENT_SEASON_REFRESH_MS = 30_000;

export function useCurrentSeason(enabled = true) {
  return useQuery({
    queryKey: ["current-season"],
    enabled,
    queryFn: () => apiRequest<CurrentSeasonResponse>("/seasons/current"),
    refetchInterval: CURRENT_SEASON_REFRESH_MS,
    refetchIntervalInBackground: true,
  });
}
