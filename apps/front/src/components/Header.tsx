import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useCurrentSeason } from "../hooks/useCurrentSeason.js";
import { LeagueBadge } from "./LeagueBadge.js";

export function Header() {
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();
  const currentSeasonQuery = useCurrentSeason(isAuthenticated && !isBootstrapping);
  const league = currentSeasonQuery.data?.me.league;

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
            <NavLink to="/tournaments" className="nav-link">
              Tournois
            </NavLink>
            <NavLink to="/profile" className="nav-link">
              Profil
            </NavLink>
            {user?.role === "admin" ? (
              <NavLink to="/admin/users" className="nav-link">
                Admin
              </NavLink>
            ) : null}
            {league ? (
              <span className="nav-league">
                <LeagueBadge name={league.name} tier={league.tier} />
              </span>
            ) : null}
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
