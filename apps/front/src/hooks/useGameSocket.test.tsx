import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createMockGameSocketFactory } from "../test/mocks/socket.js";
import {
  configureGameSocketFactory,
  resetGameSocketFactory,
  useGameSocket,
} from "./useGameSocket.js";

function GameSocketProbe({ token, matchId }: { token: string; matchId?: string }) {
  const state = useGameSocket(token, matchId);

  return (
    <div>
      <span data-testid="connected">{String(state.isConnected)}</span>
      <span data-testid="match-id">{state.matchFound?.matchId ?? "none"}</span>
      <span data-testid="round-number">{state.roundStart?.roundNumber ?? 0}</span>
      <span data-testid="round-winner">{state.roundResolved?.winner ?? "none"}</span>
      <span data-testid="match-reason">{state.matchEnded?.reason ?? "none"}</span>
      <span data-testid="error">{state.error?.message ?? "none"}</span>
    </div>
  );
}

describe("useGameSocket", () => {
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

    socket.emit("matchFound", { matchId: "match-1" });
    socket.emit("roundStart", { roundNumber: 1, deadline: "2026-06-22T12:00:00.000Z" });
    socket.emit("roundResolved", { winner: "a", scoreA: 1, scoreB: 0 });
    socket.emit("matchEnded", { reason: "COMPLETED" });

    await waitFor(() => {
      expect(getByTestId("match-id")).toHaveTextContent("match-1");
      expect(getByTestId("round-number")).toHaveTextContent("1");
      expect(getByTestId("round-winner")).toHaveTextContent("a");
      expect(getByTestId("match-reason")).toHaveTextContent("COMPLETED");
    });
  });

  it("handles socket errors", async () => {
    const { factory, sockets } = createMockGameSocketFactory();
    configureGameSocketFactory(factory);

    const { getByTestId } = render(<GameSocketProbe token="access-token" />);

    await waitFor(() => {
      expect(getByTestId("connected")).toHaveTextContent("true");
    });

    sockets[0]?.emit("error", { message: "Unauthorized" });

    await waitFor(() => {
      expect(getByTestId("error")).toHaveTextContent("Unauthorized");
      expect(getByTestId("connected")).toHaveTextContent("false");
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
