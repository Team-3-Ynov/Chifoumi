import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resolveAuthErrorMessage } from "../api/apiError.js";
import { useAuth } from "../auth/AuthContext.js";
import { LoginForm } from "../features/auth/LoginForm.js";
import type { LoginValues } from "../validation/authSchemas.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/lobby";

  async function handleSubmit(values: LoginValues) {
    setServerError(null);
    try {
      await login(values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(
        resolveAuthErrorMessage(
          error,
          { 401: "Identifiants invalides" },
          "Connexion impossible. Veuillez réessayer.",
        ),
      );
    }
  }

  return (
    <div className="auth-page">
      <h1>Connexion</h1>
      <LoginForm onSubmit={handleSubmit} serverError={serverError} />
      <p className="auth-page__switch">
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </div>
  );
}
