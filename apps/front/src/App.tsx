import { Navigate, Route, Routes } from "react-router-dom";
import { AuthenticatedLayout } from "./layouts/AuthenticatedLayout.js";
import { LeaderboardPage } from "./pages/LeaderboardPage.js";
import { LobbyPage } from "./pages/LobbyPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MatchPage } from "./pages/MatchPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { ProtectedRoute } from "./routes/ProtectedRoute.js";
import { PublicOnlyRoute } from "./routes/PublicOnlyRoute.js";

export function App() {
  return (
    <Routes>
      {/* Public routes — authenticated users are bounced to /lobby (AC5). */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected routes — anonymous users are redirected to /login (AC4). */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  );
}
