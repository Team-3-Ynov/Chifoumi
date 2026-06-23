import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../queryClient.js";
import { AuthProvider, useAuth } from "./AuthContext.js";
import { getStoredRefreshToken, setStoredRefreshToken } from "./authStorage.js";

function AuthProbe() {
  const { login, logout, isBootstrapping, isAuthenticated, user } = useAuth();

  if (isBootstrapping) {
    return <div>bootstrapping</div>;
  }

  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.displayName ?? "none"}</span>
      <button
        type="button"
        onClick={() => {
          void login("player@example.com", "secret").catch(() => undefined);
        }}
      >
        Login
      </button>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  );
}

function renderAuthProbe(initialEntries: string[] = ["/lobby"]) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    queryClient.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
    sessionStorage.clear();
  });

  it("logs in successfully", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: {
              id: "user-1",
              email: "player@example.com",
              displayName: "player1",
              role: "player",
            },
            tokens: { access: "access-token", refresh: "refresh-token" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    renderAuthProbe();

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("user")).toHaveTextContent("player1");
    });
  });

  it("surfaces login failures", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "INVALID_CREDENTIALS" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    renderAuthProbe();

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("none");
    });
  });

  it("logs out and clears cached queries", async () => {
    const user = userEvent.setup();
    queryClient.setQueryData(["me", "history", "user-a", 20], {
      pages: [{ items: [{ matchId: "match-1" }] }],
      pageParams: [undefined],
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    renderAuthProbe();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(queryClient.getQueryData(["me", "history", "user-a", 20])).toBeUndefined();
    });
  });

  it("refreshes the session automatically on bootstrap", async () => {
    setStoredRefreshToken("stored-refresh");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ tokens: { access: "fresh-access", refresh: "fresh-refresh" } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "user-1",
            email: "player@example.com",
            displayName: "player1",
            role: "player",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    renderAuthProbe();

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("user")).toHaveTextContent("player1");
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/refresh"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/me"))).toBe(true);
  });

  it("clears a revoked refresh token during bootstrap", async () => {
    setStoredRefreshToken("revoked-refresh");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    renderAuthProbe();

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("none");
    });

    expect(getStoredRefreshToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/refresh"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/me"))).toBe(false);
  });
});
