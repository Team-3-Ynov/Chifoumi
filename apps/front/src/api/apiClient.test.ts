import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequest,
  buildTournamentsPath,
  configureApiClient,
  forgotPassword,
  formatApiError,
  getTournament,
  listTournaments,
  refreshTokens,
  registerForTournament,
  unregisterFromTournament,
} from "./apiClient.js";
import type { TournamentDetail, TournamentListResponse } from "./types.js";

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

describe("buildTournamentsPath", () => {
  it("builds the default tournaments path without filter", () => {
    expect(buildTournamentsPath()).toBe("/tournaments");
  });

  it("adds the selected status filter", () => {
    expect(buildTournamentsPath("registration_open")).toBe("/tournaments?status=registration_open");
  });
});

describe("tournament registration methods", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    configureApiClient({
      getAccessToken: () => null,
      refreshAccessToken: async () => null,
      onAuthFailure: () => undefined,
    });
  });

  it("registers via POST and unregisters via DELETE on the register endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerForTournament("t-1")).resolves.toBeUndefined();
    await expect(unregisterFromTournament("t-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/tournaments/t-1/register"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/tournaments/t-1/register"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("tournament read methods", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the paginated list response from the API", async () => {
    const listFixture: TournamentListResponse = {
      items: [
        {
          id: "9b6f7c2a-4e8c-4b1a-9f24-5a7a7a8e6c4a",
          name: "Spring Cup 2026",
          format: "single_elim",
          bracketSize: 16,
          status: "registration_open",
          registrationsCount: 12,
          startsAt: "2026-07-15T18:00:00.000Z",
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(listFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listTournaments("registration_open")).resolves.toEqual(listFixture);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tournaments?status=registration_open"),
      expect.anything(),
    );
  });

  it("parses the detail response with registrations and bracket", async () => {
    const detailFixture: TournamentDetail = {
      id: "9b6f7c2a-4e8c-4b1a-9f24-5a7a7a8e6c4a",
      name: "Spring Cup 2026",
      format: "single_elim",
      bracketSize: 16,
      status: "in_progress",
      registrationsCount: 2,
      startsAt: "2026-07-15T18:00:00.000Z",
      registrationOpensAt: "2026-07-01T00:00:00.000Z",
      endedAt: null,
      registrations: [
        { userId: "0d7b6f95-f0a3-49de-9f6d-3b0bfc7e4c1d", displayName: "Ada", seed: 1 },
        { userId: "1f6f6a55-7c2c-4149-b9fe-b78da5cb6944", displayName: "Linus", seed: 2 },
      ],
      bracket: [
        {
          round: 1,
          matches: [
            {
              id: "d91fdde2-e4c2-4e89-a80e-328245385d2d",
              matchId: null,
              slotA: { userId: "0d7b6f95-f0a3-49de-9f6d-3b0bfc7e4c1d", displayName: "Ada" },
              slotB: { userId: "1f6f6a55-7c2c-4149-b9fe-b78da5cb6944", displayName: "Linus" },
              scoreA: null,
              scoreB: null,
              winnerSlot: null,
            },
          ],
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(detailFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTournament(detailFixture.id)).resolves.toEqual(detailFixture);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/tournaments/${detailFixture.id}`),
      expect.anything(),
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
