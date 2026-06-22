import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="app-header">
      <span className="app-header__brand">Chifoumi Ranked</span>
      {user ? (
        <div className="app-header__user">
          <span className="app-header__name">{user.displayName}</span>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Déconnexion…" : "Logout"}
          </button>
        </div>
      ) : null}
    </header>
  );
}
