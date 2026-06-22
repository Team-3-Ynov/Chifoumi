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

export function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const onEvent = (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    };
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`${event} timeout`));
    }, timeoutMs);

    socket.once(event, onEvent);
  });
}

export async function connectAuthenticated(
  gameUrl: string,
  accessToken: string,
): Promise<{ socket: Socket; connected: ConnectedPayload }> {
  const socket = connectWs(gameUrl, accessToken);
  try {
    const connected = await new Promise<ConnectedPayload>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("connected", onConnected);
        socket.off("connect_error", onConnectError);
      };
      const onConnected = (payload: ConnectedPayload) => {
        cleanup();
        resolve(payload);
      };
      const onConnectError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("connected timeout"));
      }, 20_000);

      socket.once("connected", onConnected);
      socket.once("connect_error", onConnectError);
    });

    return { socket, connected };
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

export async function joinQueue(socket: Socket): Promise<void> {
  const queueJoined = waitForEvent(socket, "queueJoined");
  socket.emit("joinQueue", {});
  await queueJoined;
}

export async function playBo3Win(
  socketA: Socket,
  socketB: Socket,
  matchId: string,
  roundStart: RoundStartPayload,
): Promise<{ matchEndedA: MatchEndedPayload; matchEndedB: MatchEndedPayload }> {
  const round1ResolvedA = waitForEvent<RoundResolvedPayload>(socketA, "roundResolved");
  const round1ResolvedB = waitForEvent<RoundResolvedPayload>(socketB, "roundResolved");
  const round2StartA = waitForEvent<RoundStartPayload>(socketA, "roundStart");
  const round2StartB = waitForEvent<RoundStartPayload>(socketB, "roundStart");

  socketA.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "rock" });
  socketB.emit("play", { matchId, roundNumber: roundStart.roundNumber, move: "scissors" });
  const [, , round2Start] = await Promise.all([
    round1ResolvedA,
    round1ResolvedB,
    round2StartA,
    round2StartB,
  ]);

  const matchEndedA = waitForEvent<MatchEndedPayload>(socketA, "matchEnded");
  const matchEndedB = waitForEvent<MatchEndedPayload>(socketB, "matchEnded");

  socketA.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "paper" });
  socketB.emit("play", { matchId, roundNumber: round2Start.roundNumber, move: "rock" });

  return {
    matchEndedA: await matchEndedA,
    matchEndedB: await matchEndedB,
  };
}
