import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockGameSocketFactory } from "../test/mocks/socket.js";
import {
  configureGameSocketFactory,
  resetGameSocketFactory,
  useGameSocket,
} from "./useGameSocket.js";

function GameSocketProbe({ token, matchId }: { token: string; matchId?: string }) {
  const state = useGameSocket(token, "user-1", matchId);

  return (
    <div>
      <span data-testid="connected">{String(state.connectionState === "connected")}</span>
      <span data-testid="match-id">{state.activeMatch?.matchId ?? "none"}</span>
      <span data-testid="round-number">{state.round?.roundNumber ?? 0}</span>
      <span data-testid="round-winner">{state.roundResult?.winner ?? "none"}</span>
      <span data-testid="match-reason">{state.matchEnded?.reason ?? "none"}</span>
      <span data-testid="error">{state.error?.message ?? "none"}</span>
    </div>
  );
}

describe("useGameSocket", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    resetGameSocketFactory();
  });

  it("connects and handles core match events", async () => {
    const { factory, sockets } = createMockGameSocketFactory();
    configureGameSocketFactory(factory);

    const { getByTestId } = render(<GameSocketProbe token="access-token" matchId="match-1" />);

    await waitFor(() => {
      expect(getByTestId("connected")).toHaveTextContent("true");
    });

    const socket = sockets[0];
    if (!socket) {
      throw new Error("Expected mock socket to be created");
    }

    socket.serverEmit("matchFound", {
      matchId: "match-1",
      opponent: { displayName: "Bob", rating: 1020 },
      bestOf: 3,
    });
    socket.serverEmit("roundStart", {
      matchId: "match-1",
      roundNumber: 1,
      deadline: "2026-06-22T12:00:00.000Z",
    });
    socket.serverEmit("roundResolved", {
      matchId: "match-1",
      roundNumber: 1,
      yourMove: "rock",
      theirMove: "scissors",
      winner: "a",
      scoreA: 1,
      scoreB: 0,
    });
    socket.serverEmit("matchEnded", {
      matchId: "match-1",
      winner: "user-1",
      finalScore: { a: 2, b: 0 },
      eloDelta: { a: 16, b: -16 },
      reason: "BEST_OF_3",
    });

    await waitFor(() => {
      expect(getByTestId("match-id")).toHaveTextContent("match-1");
      expect(getByTestId("round-number")).toHaveTextContent("1");
      expect(getByTestId("round-winner")).toHaveTextContent("a");
      expect(getByTestId("match-reason")).toHaveTextContent("BEST_OF_3");
    });
  });

  it("handles socket errors", async () => {
    const { factory, sockets } = createMockGameSocketFactory();
    configureGameSocketFactory(factory);

    const { getByTestId } = render(<GameSocketProbe token="access-token" />);

    await waitFor(() => {
      expect(getByTestId("connected")).toHaveTextContent("true");
    });

    sockets[0]?.serverEmit("error", { code: "INVALID_TOKEN", message: "Unauthorized" });

    await waitFor(() => {
      expect(getByTestId("error")).toHaveTextContent("Unauthorized");
      expect(getByTestId("connected")).toHaveTextContent("true");
    });
  });

  it("disconnects on unmount", async () => {
    const { factory, sockets } = createMockGameSocketFactory();
    configureGameSocketFactory(factory);

    const { unmount } = render(<GameSocketProbe token="access-token" />);

    await waitFor(() => {
      expect(sockets[0]?.connected).toBe(true);
    });

    unmount();

    expect(sockets[0]?.disconnected).toBe(true);
  });
});
