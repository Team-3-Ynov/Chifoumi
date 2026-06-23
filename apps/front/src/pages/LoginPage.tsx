import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from && typeof location.state === "object"
      ? (location.state as { from?: string }).from
      : "/lobby";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo ?? "/lobby", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setError("Identifiants invalides.");
      } else {
        setError(caught instanceof Error ? caught.message : "Connexion impossible.");
      }
    } finally {
      setIsSubmitting(false);
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

        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="button" disabled={isSubmitting}>
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </section>
    </div>
  );
}
