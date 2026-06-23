import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { MatchAuditResponse } from "../api/types.js";

export function useMatchAudit(matchId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "match-audit", matchId],
    queryFn: () => apiRequest<MatchAuditResponse>(`/matches/${matchId}/audit`),
    enabled: Boolean(matchId),
  });
}
