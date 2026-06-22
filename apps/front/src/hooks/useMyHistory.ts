import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { MeHistoryResponse } from "../api/types.js";

const HISTORY_PAGE_SIZE = 20;

export function useMyHistory(userId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["me", "history", userId, HISTORY_PAGE_SIZE],
    enabled: enabled && Boolean(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
      if (pageParam) {
        params.set("cursor", pageParam);
      }
      return apiRequest<MeHistoryResponse>(`/me/history?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
