import type {
  ConnectedPayload,
  GameSocketError,
  MatchEndedPayload,
  MatchFoundPayload,
  MatchResumedPayload,
  PlayPayload,
  QueueJoinedPayload,
  RoundResolvedPayload,
  RoundStartPayload,
} from "@chifoumi/schemas/game-events";

export type GameSocketEventMap = {
  connected: ConnectedPayload;
  queueJoined: QueueJoinedPayload;
  queueLeft: Record<string, never>;
  matchFound: MatchFoundPayload;
  roundStart: RoundStartPayload;
  roundResolved: RoundResolvedPayload;
  matchEnded: MatchEndedPayload;
  matchResumed: MatchResumedPayload;
  error: GameSocketError;
  connect: undefined;
  disconnect: undefined;
  connect_error: Error;
};

export type GameSocketEvent = keyof GameSocketEventMap;
export type GameSocketHandler<E extends GameSocketEvent> = (payload: GameSocketEventMap[E]) => void;

export type GameSocketClientEventMap = {
  joinQueue: Record<string, never>;
  leaveQueue: Record<string, never>;
  play: PlayPayload;
};

export interface GameSocketClient {
  readonly connected: boolean;
  connect(): void;
  disconnect(): void;
  on<E extends GameSocketEvent>(event: E, handler: GameSocketHandler<E>): void;
  off<E extends GameSocketEvent>(event: E, handler: GameSocketHandler<E>): void;
  emit<E extends keyof GameSocketClientEventMap>(
    event: E,
    payload: GameSocketClientEventMap[E],
  ): void;
  removeAllListeners?(): void;
}

export type CreateGameSocket = (options: { token: string; matchId?: string }) => GameSocketClient;
