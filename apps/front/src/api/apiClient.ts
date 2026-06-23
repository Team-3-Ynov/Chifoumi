import type { RefreshResponse } from "./types.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<string | null>;
type AuthFailureHandler = () => void;

let getAccessToken: TokenProvider = () => null;
let refreshAccessToken: RefreshHandler = async () => null;
let onAuthFailure: AuthFailureHandler = () => undefined;

export function configureApiClient(config: {
  getAccessToken: TokenProvider;
  refreshAccessToken: RefreshHandler;
  onAuthFailure: AuthFailureHandler;
}): void {
  getAccessToken = config.getAccessToken;
  refreshAccessToken = config.refreshAccessToken;
  onAuthFailure = config.onAuthFailure;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function formatApiError(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const record = body as {
      message?: string | string[] | { error?: string };
      error?: string;
    };

    if (typeof record.error === "string") {
      return record.error;
    }

    if (Array.isArray(record.message)) {
      return record.message.join(", ");
    }

    if (typeof record.message === "string") {
      return record.message;
    }

    if (
      typeof record.message === "object" &&
      record.message !== null &&
      typeof record.message.error === "string"
    ) {
      return record.message.error;
    }
  }

  return `Request failed with status ${status}`;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    return formatApiError(body, response.status);
  } catch {
    // ignore parse errors
  }

  return `Request failed with status ${response.status}`;
}

async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
  allowRetry = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status !== 401 || !allowRetry || !accessToken) {
    return response;
  }

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    onAuthFailure();
    return response;
  }

  return fetchWithAuth(path, init, false);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithAuth(path, init);

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  // Some endpoints respond with an empty body on success (204 No Content, or
  // 200 OK with no payload like POST /auth/forgot-password). Only parse JSON
  // when there is actually a body, otherwise JSON.parse would throw on success.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function refreshTokens(refreshToken: string): Promise<RefreshResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return (await response.json()) as RefreshResponse;
}
