import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { AdminRoute } from "./components/AdminRoute.js";
import { Header } from "./components/Header.js";
import { GuestRoute, ProtectedRoute } from "./components/ProtectedRoute.js";
import { GameSocketProvider } from "./game/GameSocketContext.js";
import { AdminMatchAuditPage } from "./pages/admin/AdminMatchAuditPage.js";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { LeaderboardPage } from "./pages/LeaderboardPage.js";
import { LobbyPage } from "./pages/LobbyPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MatchPage } from "./pages/MatchPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.js";
import "./App.css";

function CatchAllRedirect() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="page">
        <div className="panel">
          <p className="muted">Chargement…</p>
        </div>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/lobby" : "/login"} replace />;
}

export function App() {
  return (
    <GameSocketProvider>
      <div className="layout">
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />

          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="/leaderboard" element={<LeaderboardPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/match/:matchId" element={<MatchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/matches/:id" element={<AdminMatchAuditPage />} />
          </Route>

          <Route path="*" element={<CatchAllRedirect />} />
        </Routes>
      </div>
    </GameSocketProvider>
  );
}
