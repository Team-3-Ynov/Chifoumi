import { useEffect, useRef, useState } from "react";
import type {
  CreateGameSocket,
  GameSocketClient,
  GameSocketErrorPayload,
  GameSocketEvent,
  GameSocketEventMap,
  MatchEndedPayload,
  MatchFoundPayload,
  RoundResolvedPayload,
  RoundStartPayload,
} from "./gameSocketTypes.js";

let createGameSocketImpl: CreateGameSocket = () => ({
  connect: () => undefined,
  disconnect: () => undefined,
  on: () => undefined,
  off: () => undefined,
});

export function configureGameSocketFactory(factory: CreateGameSocket): void {
  createGameSocketImpl = factory;
}

export function resetGameSocketFactory(): void {
  createGameSocketImpl = () => ({
    connect: () => undefined,
    disconnect: () => undefined,
    on: () => undefined,
    off: () => undefined,
  });
}

export type GameSocketState = {
  isConnected: boolean;
  matchFound: MatchFoundPayload | null;
  roundStart: RoundStartPayload | null;
  roundResolved: RoundResolvedPayload | null;
  matchEnded: MatchEndedPayload | null;
  error: GameSocketErrorPayload | null;
};

const INITIAL_STATE: GameSocketState = {
  isConnected: false,
  matchFound: null,
  roundStart: null,
  roundResolved: null,
  matchEnded: null,
  error: null,
};

export function useGameSocket(token: string | null, matchId?: string): GameSocketState {
  const [state, setState] = useState<GameSocketState>(INITIAL_STATE);
  const socketRef = useRef<GameSocketClient | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = createGameSocketImpl({ token, matchId });
    socketRef.current = socket;

    const handlers: {
      [E in GameSocketEvent]: (payload: GameSocketEventMap[E]) => void;
    } = {
      matchFound: (payload) => {
        setState((current) => ({ ...current, matchFound: payload }));
      },
      roundStart: (payload) => {
        setState((current) => ({ ...current, roundStart: payload }));
      },
      roundResolved: (payload) => {
        setState((current) => ({ ...current, roundResolved: payload }));
      },
      matchEnded: (payload) => {
        setState((current) => ({ ...current, matchEnded: payload }));
      },
      error: (payload) => {
        setState((current) => ({ ...current, error: payload, isConnected: false }));
      },
    };

    for (const [event, handler] of Object.entries(handlers) as Array<
      [GameSocketEvent, (payload: GameSocketEventMap[GameSocketEvent]) => void]
    >) {
      socket.on(event, handler);
    }

    socket.connect();
    setState({ ...INITIAL_STATE, isConnected: true });

    return () => {
      for (const [event, handler] of Object.entries(handlers) as Array<
        [GameSocketEvent, (payload: GameSocketEventMap[GameSocketEvent]) => void]
      >) {
        socket.off(event, handler);
      }
      socket.disconnect();
      socketRef.current = null;
      setState(INITIAL_STATE);
    };
  }, [token, matchId]);

  return state;
}
