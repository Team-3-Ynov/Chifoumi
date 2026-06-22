import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.js";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register(email, password, displayName);
      navigate("/lobby", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError("Email déjà utilisé.");
      } else {
        setError(caught instanceof Error ? caught.message : "Inscription impossible.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="register-title">
        <h1 id="register-title" className="title">
          Inscription
        </h1>
        <p className="subtitle">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>

        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9]+"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

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
              autoComplete="new-password"
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
            {isSubmitting ? "Création…" : "Créer le compte"}
          </button>
        </form>
      </section>
    </div>
  );
}
