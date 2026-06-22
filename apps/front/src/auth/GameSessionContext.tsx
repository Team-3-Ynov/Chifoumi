import { createContext, type ReactNode, useContext } from "react";

export type GameUser = {
  id: string;
  displayName: string;
  rating?: number;
};

export type GameSession = {
  accessToken: string;
  user: GameUser;
};

const GameSessionContext = createContext<GameSession | null>(null);

type GameSessionProviderProps = {
  children: ReactNode;
  session?: GameSession | null;
};

export function GameSessionProvider({ children, session = null }: GameSessionProviderProps) {
  return <GameSessionContext.Provider value={session}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSession | null {
  return useContext(GameSessionContext);
}
