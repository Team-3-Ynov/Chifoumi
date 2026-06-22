import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header.js";
import { GuestRoute, ProtectedRoute } from "./components/ProtectedRoute.js";
import { LeaderboardPage } from "./pages/LeaderboardPage.js";
import { LobbyPage } from "./pages/LobbyPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import "./App.css";

export function App() {
  return (
    <div className="layout">
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/leaderboard" element={<LeaderboardPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </div>
  );
}
