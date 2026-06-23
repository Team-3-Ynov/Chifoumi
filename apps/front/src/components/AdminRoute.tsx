import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

/**
 * Route guard for the admin area. Like {@link ProtectedRoute} it requires an
 * authenticated session, but additionally restricts access to users whose role
 * is `admin`. Non-admin players are sent back to the lobby.
 */
export function AdminRoute() {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="page">
        <div className="panel">
          <p className="muted">Chargement de la session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/lobby" replace />;
  }

  return <Outlet />;
}
