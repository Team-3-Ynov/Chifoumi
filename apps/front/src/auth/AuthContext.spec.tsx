import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/authApi.js", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

import * as authApi from "../api/authApi.js";
import { AuthProvider, useAuth } from "./AuthContext.js";
import { tokenStorage } from "./tokenStorage.js";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  tokenStorage.clear();
});

describe("AuthContext", () => {
  it("starts unauthenticated when no refresh token is stored", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("login stores the tokens and sets the user", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: { id: "u1", email: "a@b.com", displayName: "alice", role: "player" },
      tokens: { access: "access-1", refresh: "refresh-1" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ email: "a@b.com", password: "password1234" });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.displayName).toBe("alice");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-1");
  });

  it("logout calls the API and clears the session", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: { id: "u1", email: "a@b.com", displayName: "alice", role: "player" },
      tokens: { access: "access-1", refresh: "refresh-1" },
    });
    vi.mocked(authApi.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login({ email: "a@b.com", password: "password1234" });
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(false);
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it("restores the session on mount from sessionStorage (no network)", async () => {
    tokenStorage.setSession(
      { id: "u1", email: "a@b.com", displayName: "bob", role: "player" },
      { access: "access-1", refresh: "refresh-1" },
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.displayName).toBe("bob");
  });
});
