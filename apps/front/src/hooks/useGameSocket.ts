import {
  type GameSocketError,
  gameSocketErrorSchema,
  type MatchEndedPayload,
  type MatchFoundPayload,
  type MatchResumedPayload,
  type Move,
  matchEndedPayloadSchema,
  matchFoundPayloadSchema,
  matchResumedPayloadSchema,
  queueJoinedPayloadSchema,
  type RoundResolvedPayload,
  type RoundStartPayload,
  roundResolvedPayloadSchema,
  roundStartPayloadSchema,
} from "@chifoumi/schemas/game-events";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ZodType } from "zod";
import { useGameSession } from "../auth/GameSessionContext.js";

const activeMatchStoragePrefix = "chifoumi.activeMatch";
const gameServiceUrl = import.meta.env.VITE_GAME_SERVICE_URL ?? "http://localhost:3001";

export type GameConnectionState = "disconnected" | "connecting" | "connected";
export type QueueState =
  | { status: "idle" }
  | { status: "queued"; queuedAt: string; currentRating: number };

export type ActiveMatch = MatchFoundPayload;

export type GameSocketState = {
  connectionState: GameConnectionState;
  queue: QueueState;
  activeMatch: ActiveMatch | null;
  round: RoundStartPayload | null;
  roundResult: RoundResolvedPayload | null;
  matchEnded: MatchEndedPayload | null;
  score: { a: number; b: number };
  awaitingOpponent: boolean;
  error: GameSocketError | null;
  matchFoundVersion: number;
};

export type GameSocketActions = {
  joinQueue: () => void;
  leaveQueue: () => void;
  play: (matchId: string, roundNumber: number, move: Move) => void;
  clearMatch: () => void;
  clearError: () => void;
  acknowledgeMatchFound: () => void;
};

export type UseGameSocketResult = GameSocketState & GameSocketActions;

export function useGameSocket(_matchId?: string): UseGameSocketResult {
  const session = useGameSession();
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<GameConnectionState>("disconnected");
  const [queue, setQueue] = useState<QueueState>({ status: "idle" });
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(() =>
    readStoredMatch(session?.user.id),
  );
  const [round, setRound] = useState<RoundStartPayload | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResolvedPayload | null>(null);
  const [matchEnded, setMatchEnded] = useState<MatchEndedPayload | null>(null);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [awaitingOpponent, setAwaitingOpponent] = useState(false);
  const [error, setError] = useState<GameSocketError | null>(null);
  const [matchFoundVersion, setMatchFoundVersion] = useState(0);

  useEffect(() => {
    if (!session?.accessToken) {
      setConnectionState("disconnected");
      setActiveMatch(null);
      return;
    }

    setActiveMatch(readStoredMatch(session.user.id));
    setConnectionState("connecting");
    const socket = io(`${gameServiceUrl.replace(/\/$/, "")}/game`, {
      query: { token: session.accessToken },
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
      setError(null);
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    socket.on("connect_error", (connectionError) => {
      setConnectionState("disconnected");
      const code = readConnectionErrorCode(connectionError);
      setError({ code, message: connectionError.message || "Connexion au jeu impossible" });
    });

    socket.on("queueJoined", (payload: unknown) => {
      const parsed = parsePayload(queueJoinedPayloadSchema, payload, "queueJoined", setError);
      if (parsed) {
        setQueue({ status: "queued", ...parsed });
      }
    });

    socket.on("queueLeft", () => {
      setQueue({ status: "idle" });
    });

    socket.on("matchFound", (payload: unknown) => {
      const parsed = parsePayload(matchFoundPayloadSchema, payload, "matchFound", setError);
      if (parsed) {
        storeMatch(session.user.id, parsed);
        setActiveMatch(parsed);
        setQueue({ status: "idle" });
        setMatchEnded(null);
        setScore({ a: 0, b: 0 });
        setMatchFoundVersion((version) => version + 1);
      }
    });

    socket.on("roundStart", (payload: unknown) => {
      const parsed = parsePayload(roundStartPayloadSchema, payload, "roundStart", setError);
      if (parsed) {
        setRound(parsed);
        setAwaitingOpponent(false);
      }
    });

    socket.on("roundResolved", (payload: unknown) => {
      const parsed = parsePayload(roundResolvedPayloadSchema, payload, "roundResolved", setError);
      if (parsed) {
        setRoundResult(parsed);
        setScore({ a: parsed.scoreA, b: parsed.scoreB });
        setAwaitingOpponent(false);
      }
    });

    socket.on("matchEnded", (payload: unknown) => {
      const parsed = parsePayload(matchEndedPayloadSchema, payload, "matchEnded", setError);
      if (parsed) {
        setMatchEnded(parsed);
        setScore(parsed.finalScore);
        setAwaitingOpponent(false);
      }
    });

    socket.on("matchResumed", (payload: unknown) => {
      const parsed = parsePayload(matchResumedPayloadSchema, payload, "matchResumed", setError);
      if (parsed) {
        restoreResumedMatch(session.user.id, parsed, setActiveMatch);
        setRound({
          matchId: parsed.matchId,
          roundNumber: parsed.currentRound,
          deadline: parsed.deadline,
        });
        setRoundResult(null);
        setMatchEnded(null);
        setScore({ a: parsed.scoreA, b: parsed.scoreB });
        setAwaitingOpponent(parsed.currentState !== "WAITING_PLAYS");
      }
    });

    socket.on("error", (payload: unknown) => {
      const parsed = gameSocketErrorSchema.safeParse(payload);
      setError(
        parsed.success
          ? parsed.data
          : { code: "INVALID_ERROR_PAYLOAD", message: "Erreur de jeu inattendue" },
      );
      setAwaitingOpponent(false);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnectionState("disconnected");
    };
  }, [session?.accessToken, session?.user.id]);

  const joinQueue = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError({ code: "SOCKET_DISCONNECTED", message: "Connexion au jeu indisponible" });
      return;
    }
    setError(null);
    socket.emit("joinQueue", {});
  }, []);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit("leaveQueue", {});
  }, []);

  const play = useCallback((matchId: string, roundNumber: number, move: Move) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError({ code: "SOCKET_DISCONNECTED", message: "Connexion au jeu indisponible" });
      return;
    }
    setAwaitingOpponent(true);
    setError(null);
    socket.emit("play", { matchId, roundNumber, move });
  }, []);

  const clearMatch = useCallback(() => {
    if (session?.user.id) {
      sessionStorage.removeItem(activeMatchStorageKey(session.user.id));
    }
    setActiveMatch(null);
    setRound(null);
    setRoundResult(null);
    setMatchEnded(null);
    setScore({ a: 0, b: 0 });
    setAwaitingOpponent(false);
  }, [session?.user.id]);

  const clearError = useCallback(() => setError(null), []);
  const acknowledgeMatchFound = useCallback(() => setMatchFoundVersion(0), []);

  return {
    connectionState,
    queue,
    activeMatch,
    round,
    roundResult,
    matchEnded,
    score,
    awaitingOpponent,
    error,
    matchFoundVersion,
    joinQueue,
    leaveQueue,
    play,
    clearMatch,
    clearError,
    acknowledgeMatchFound,
  };
}

function parsePayload<T>(
  schema: ZodType<T>,
  payload: unknown,
  event: string,
  setError: (error: GameSocketError) => void,
): T | null {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }
  setError({
    code: "INVALID_SERVER_PAYLOAD",
    message: `Le serveur a envoyé un événement ${event} invalide`,
  });
  return null;
}

function readStoredMatch(userId?: string): ActiveMatch | null {
  if (!userId) {
    return null;
  }
  const raw = sessionStorage.getItem(activeMatchStorageKey(userId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = matchFoundPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function storeMatch(userId: string, match: ActiveMatch): void {
  sessionStorage.setItem(activeMatchStorageKey(userId), JSON.stringify(match));
}

function restoreResumedMatch(
  userId: string,
  resumed: MatchResumedPayload,
  setActiveMatch: (updater: (current: ActiveMatch | null) => ActiveMatch) => void,
): void {
  setActiveMatch((current) => {
    const match =
      current?.matchId === resumed.matchId
        ? current
        : {
            matchId: resumed.matchId,
            opponent: { displayName: "Adversaire", rating: 0 },
            bestOf: 3 as const,
          };
    storeMatch(userId, match);
    return match;
  });
}

function activeMatchStorageKey(userId: string): string {
  return `${activeMatchStoragePrefix}:${userId}`;
}

function readConnectionErrorCode(error: Error): string | number {
  const data = (error as Error & { data?: { code?: unknown } }).data;
  return typeof data?.code === "string" || typeof data?.code === "number"
    ? data.code
    : "CONNECTION_ERROR";
}
