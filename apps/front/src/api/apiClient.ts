import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "../auth/tokenStorage.js";
import type { AuthTokens } from "./types.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const REFRESH_PATH = "/auth/refresh";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean };

let sessionExpiredHandler: (() => void) | null = null;

// Lets the AuthProvider react (drop the session) when a background refresh fails.
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

// Single-flight guard: concurrent 401s share a single refresh request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await apiClient.post<{ tokens: AuthTokens }>(REFRESH_PATH, { refreshToken });
    tokenStorage.setTokens(data.tokens);
    return data.tokens.access;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

apiClient.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequest | undefined;

    // Ignore non-401s, already-retried requests, and a 401 from the refresh call
    // itself (guards against an infinite refresh loop).
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retried ||
      original.url === REFRESH_PATH
    ) {
      return Promise.reject(error);
    }

    original._retried = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      sessionExpiredHandler?.();
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${newAccessToken}`;
    return apiClient(original);
  },
);
