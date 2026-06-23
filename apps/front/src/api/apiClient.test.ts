import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequest,
  configureApiClient,
  forgotPassword,
  formatApiError,
  refreshTokens,
} from "./apiClient.js";

describe("formatApiError", () => {
  it("returns nested error field from API body", () => {
    expect(formatApiError({ error: "USER_NOT_FOUND" }, 404)).toBe("USER_NOT_FOUND");
  });

  it("returns string message from validation errors", () => {
    expect(formatApiError({ message: "Unauthorized" }, 401)).toBe("Unauthorized");
  });

  it("joins array validation messages", () => {
    expect(formatApiError({ message: ["email must be an email", "password too short"] }, 400)).toBe(
      "email must be an email, password too short",
    );
  });

  it("falls back to status code message", () => {
    expect(formatApiError({}, 500)).toBe("Request failed with status 500");
  });
});

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    configureApiClient({
      getAccessToken: () => null,
      refreshAccessToken: async () => null,
      onAuthFailure: () => undefined,
    });
  });

  it("retries once with a refreshed access token after 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-1", displayName: "player1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    let accessToken = "expired-token";

    configureApiClient({
      getAccessToken: () => accessToken,
      refreshAccessToken: async () => {
        accessToken = "fresh-token";
        return accessToken;
      },
      onAuthFailure: () => undefined,
    });

    const result = await apiRequest<{ id: string; displayName: string }>("/me");

    expect(result).toEqual({ id: "user-1", displayName: "player1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.get("Authorization")).toBe("Bearer fresh-token");
  });

  it("throws ApiError with parsed API error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "USER_NOT_FOUND" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(apiRequest("/users/missing/profile")).rejects.toEqual(
      new ApiError("USER_NOT_FOUND", 404),
    );
  });

  it("resolves successful empty 200 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(forgotPassword("player@example.com")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/forgot-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "player@example.com" }),
      }),
    );
  });
});

describe("refreshTokens", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the refresh token to the auth endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tokens: { access: "a", refresh: "r" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshTokens("stored-refresh");

    expect(result).toEqual({ tokens: { access: "a", refresh: "r" } });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "stored-refresh" }),
      }),
    );
  });
});
