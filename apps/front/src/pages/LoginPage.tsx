import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.js";
import { LoginForm } from "../components/LoginForm.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);

  const redirectTo =
    (location.state as { from?: string } | null)?.from && typeof location.state === "object"
      ? (location.state as { from?: string }).from
      : "/lobby";

  async function handleLogin(values: { email: string; password: string }) {
    setApiError(null);

    try {
      await login(values.email, values.password);
      navigate(redirectTo ?? "/lobby", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setApiError("Identifiants invalides.");
      } else {
        setApiError(caught instanceof Error ? caught.message : "Connexion impossible.");
      }
    }
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="login-title">
        <h1 id="login-title" className="title">
          Connexion
        </h1>
        <p className="subtitle">
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </p>

        <LoginForm onSubmit={handleLogin} apiError={apiError} />
      </section>
    </div>
  );
}
