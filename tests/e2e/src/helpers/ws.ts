import { io, type Socket } from "socket.io-client";

export type ConnectedPayload = { userId: string; displayName: string };
export type MatchFoundPayload = {
  matchId: string;
  opponent: { userId: string; displayName: string; rating: number };
  bestOf: number;
};
export type RoundStartPayload = { matchId: string; roundNumber: number; deadline: string };
export type RoundResolvedPayload = {
  matchId: string;
  roundNumber: number;
  yourMove: string;
  theirMove: string;
  winner: string;
  scoreA: number;
  scoreB: number;
};
export type MatchEndedPayload = {
  matchId: string;
  winner: string | null;
  finalScore: { a: number; b: number };
  eloDelta: { a: number; b: number };
  reason?: string;
};

export function connectWs(gameUrl: string, accessToken: string): Socket {
  return io(`${gameUrl}/game`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    query: { token: accessToken },
  });
}

export function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} timeout`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

export async function connectAuthenticated(
  gameUrl: string,
  accessToken: string,
): Promise<{ socket: Socket; connected: ConnectedPayload }> {
  const socket = connectWs(gameUrl, accessToken);
  const connectedPromise = waitForEvent<ConnectedPayload>(socket, "connected");

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });

  const connected = await connectedPromise;
  return { socket, connected };
}

export async function joinQueue(socket: Socket): Promise<void> {
  socket.emit("joinQueue", {});
  await waitForEvent(socket, "queueJoined");
}

export async function playBo3Win(
  socketA: Socket,
  socketB: Socket,
  matchId: string,
  roundStart: RoundStartPayload,
): Promise<{ matchEndedA: MatchEndedPayload; matchEndedB: MatchEndedPayload }> {
  const round1ResolvedA = waitForEvent<RoundResolvedPayload>(socketA, "roundResolved");
  const round1ResolvedB = waitForEvent<RoundResolvedPayload>(socketB, "roundResolved");

  socketA.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "rock" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  socketB.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "scissors" });
  await round1ResolvedA;
  await round1ResolvedB;

  const round2Start = await waitForEvent<RoundStartPayload>(socketA, "roundStart");
  await waitForEvent<RoundStartPayload>(socketB, "roundStart");

  const matchEndedA = waitForEvent<MatchEndedPayload>(socketA, "matchEnded");
  const matchEndedB = waitForEvent<MatchEndedPayload>(socketB, "matchEnded");

  socketA.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "paper" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  socketB.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "rock" });

  return {
    matchEndedA: await matchEndedA,
    matchEndedB: await matchEndedB,
  };
}
