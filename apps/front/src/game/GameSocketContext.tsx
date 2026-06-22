import { createContext, type ReactNode, useContext } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { type UseGameSocketResult, useGameSocket } from "../hooks/useGameSocket.js";

const GameSocketContext = createContext<UseGameSocketResult | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const game = useGameSocket(accessToken, user?.id);
  return <GameSocketContext.Provider value={game}>{children}</GameSocketContext.Provider>;
}

export function useGame(): UseGameSocketResult {
  const game = useContext(GameSocketContext);
  if (!game) {
    throw new Error("useGame must be used inside GameSocketProvider");
  }
  return game;
}
