import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import {
  type GameSession,
  GameSessionProvider,
  useGameSession,
} from "./auth/GameSessionContext.js";
import { GameSocketProvider } from "./game/GameSocketContext.js";
import { LobbyPage } from "./pages/LobbyPage.js";
import { MatchPage } from "./pages/MatchPage.js";

export type AppProps = {
  session?: GameSession | null;
};

export function App({ session = null }: AppProps) {
  return (
    <GameSessionProvider session={session}>
      <BrowserRouter>
        <GameSocketProvider>
          <Routes>
            <Route element={<RequireGameSession />}>
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/match/:matchId" element={<MatchPage />} />
            </Route>
            <Route path="/login" element={<AuthIntegrationPage />} />
            <Route path="*" element={<Navigate replace to="/lobby" />} />
          </Routes>
        </GameSocketProvider>
      </BrowserRouter>
    </GameSessionProvider>
  );
}

function RequireGameSession() {
  const session = useGameSession();
  const location = useLocation();
  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}

function AuthIntegrationPage() {
  const session = useGameSession();
  if (session) {
    return <Navigate replace to="/lobby" />;
  }
  return (
    <main className="game-shell">
      <section className="auth-bridge-card">
        <span className="eyebrow">Session requise</span>
        <h1>Connectez-vous pour jouer</h1>
        <p>
          Les écrans d’authentification sont fournis par l’US-040. Son AuthContext devra passer la
          session en mémoire à la propriété <code>session</code> de l’application.
        </p>
      </section>
    </main>
  );
}
