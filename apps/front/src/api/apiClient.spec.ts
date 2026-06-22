import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../auth/tokenStorage.js";
import { apiClient, setSessionExpiredHandler } from "./apiClient.js";

describe("apiClient 401 → refresh interceptor (AC4)", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    tokenStorage.clear();
    setSessionExpiredHandler(null);
  });

  afterEach(() => {
    mock.restore();
    tokenStorage.clear();
    setSessionExpiredHandler(null);
  });

  it("refreshes the token and replays the original request transparently", async () => {
    tokenStorage.setTokens({ access: "stale-access", refresh: "refresh-1" });

    mock.onGet("/me").replyOnce(401);
    mock.onPost("/auth/refresh").reply(200, {
      tokens: { access: "fresh-access", refresh: "refresh-2" },
    });
    mock.onGet("/me").reply(200, { id: "u1", displayName: "alice" });

    const response = await apiClient.get<{ id: string; displayName: string }>("/me");

    expect(response.data).toEqual({ id: "u1", displayName: "alice" });
    expect(tokenStorage.getAccessToken()).toBe("fresh-access");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
  });

  it("clears the session and notifies when the refresh fails", async () => {
    tokenStorage.setTokens({ access: "stale-access", refresh: "expired-refresh" });
    const onSessionExpired = vi.fn();
    setSessionExpiredHandler(onSessionExpired);

    mock.onGet("/me").reply(401);
    mock.onPost("/auth/refresh").reply(401);

    await expect(apiClient.get("/me")).rejects.toBeDefined();

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it("does not attempt a refresh when there is no refresh token", async () => {
    const onSessionExpired = vi.fn();
    setSessionExpiredHandler(onSessionExpired);
    const refreshSpy = vi.fn();
    mock.onPost("/auth/refresh").reply(() => {
      refreshSpy();
      return [200, { tokens: { access: "x", refresh: "y" } }];
    });
    mock.onGet("/me").reply(401);

    await expect(apiClient.get("/me")).rejects.toBeDefined();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
