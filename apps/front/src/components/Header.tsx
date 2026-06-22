import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function Header() {
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();

  return (
    <header className="header">
      <Link to={isAuthenticated ? "/lobby" : "/login"} className="brand">
        Chifoumi Ranked
      </Link>

      <nav className="nav" aria-label="Main navigation">
        {isBootstrapping ? (
          <span className="nav-user muted">Chargement…</span>
        ) : isAuthenticated ? (
          <>
            <NavLink to="/lobby" className="nav-link">
              Lobby
            </NavLink>
            <NavLink to="/leaderboard" className="nav-link">
              Leaderboard
            </NavLink>
            <NavLink to="/profile" className="nav-link">
              Profil
            </NavLink>
            <span className="nav-user">{user?.displayName}</span>
            <button type="button" className="button button-secondary" onClick={() => void logout()}>
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/leaderboard" className="nav-link">
              Leaderboard
            </NavLink>
            <NavLink to="/login" className="nav-link">
              Login
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
