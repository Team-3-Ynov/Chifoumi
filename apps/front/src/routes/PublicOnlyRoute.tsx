import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { FullPageLoader } from "../components/FullPageLoader.js";

// Keeps already-authenticated users away from /login and /register (AC5).
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/lobby" replace />;
  }

  return <Outlet />;
}
