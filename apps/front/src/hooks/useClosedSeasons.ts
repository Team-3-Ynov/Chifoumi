import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { ClosedSeasonsResponse } from "../api/types.js";

export function useClosedSeasons() {
  return useQuery({
    queryKey: ["closed-seasons"],
    queryFn: () => apiRequest<ClosedSeasonsResponse>("/seasons/closed"),
  });
}
