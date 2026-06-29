import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { AdminUsersResponse } from "../api/types.js";

export const ADMIN_USERS_PAGE_SIZE = 20;

export function useAdminUsers(page: number) {
  return useQuery({
    queryKey: ["admin", "users", page],
    queryFn: () =>
      apiRequest<AdminUsersResponse>(`/users?page=${page}&limit=${ADMIN_USERS_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });
}
