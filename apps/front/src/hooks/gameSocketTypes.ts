export type MatchFoundPayload = {
  matchId: string;
};

export type RoundStartPayload = {
  roundNumber: number;
  deadline: string;
};

export type RoundResolvedPayload = {
  winner: "a" | "b" | "draw";
  scoreA: number;
  scoreB: number;
};

export type MatchEndedPayload = {
  reason: string;
};

export type GameSocketErrorPayload = {
  message: string;
};

export type GameSocketEventMap = {
  matchFound: MatchFoundPayload;
  roundStart: RoundStartPayload;
  roundResolved: RoundResolvedPayload;
  matchEnded: MatchEndedPayload;
  error: GameSocketErrorPayload;
};

export type GameSocketEvent = keyof GameSocketEventMap;

export type GameSocketHandler<E extends GameSocketEvent> = (payload: GameSocketEventMap[E]) => void;

export interface GameSocketClient {
  connect(): void;
  disconnect(): void;
  on<E extends GameSocketEvent>(event: E, handler: GameSocketHandler<E>): void;
  off<E extends GameSocketEvent>(event: E, handler: GameSocketHandler<E>): void;
}

export type CreateGameSocket = (options: { token: string; matchId?: string }) => GameSocketClient;
