import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, resetPassword } from "../api/apiClient.js";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Lien de réinitialisation invalide ou incomplet.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      navigate("/login", {
        replace: true,
        state: { notice: "Mot de passe réinitialisé. Vous pouvez maintenant vous connecter." },
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
        setError("Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.");
      } else {
        setError(
          caught instanceof Error ? caught.message : "Réinitialisation impossible pour le moment.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="reset-password-title">
        <h1 id="reset-password-title" className="title">
          Nouveau mot de passe
        </h1>

        {token ? (
          <p className="subtitle">Choisissez un nouveau mot de passe pour votre compte.</p>
        ) : (
          <p className="subtitle">
            Ce lien de réinitialisation est invalide ou incomplet.{" "}
            <Link to="/forgot-password">Demander un nouveau lien</Link>
          </p>
        )}

        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              disabled={!token}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Confirmer le mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              disabled={!token}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="button" disabled={isSubmitting || !token}>
            {isSubmitting ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
          </button>
        </form>

        <p className="subtitle">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </section>
    </div>
  );
}
