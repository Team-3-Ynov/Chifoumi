import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/apiClient.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await forgotPassword(email);
    } catch {
      // Anti-enumeration: never reveal whether the email exists or any
      // technical detail — always show the same generic confirmation.
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="forgot-password-title">
        <h1 id="forgot-password-title" className="title">
          Mot de passe oublié
        </h1>

        {isSubmitted ? (
          <>
            <output className="subtitle">
              Si un compte est associé à cette adresse, un e-mail contenant un lien de
              réinitialisation vient d'être envoyé.
            </output>
            <p className="subtitle">
              <Link to="/login">Retour à la connexion</Link>
            </p>
          </>
        ) : (
          <>
            <p className="subtitle">
              Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.
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

              <button type="submit" className="button" disabled={isSubmitting}>
                {isSubmitting ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>

            <p className="subtitle">
              <Link to="/login">Retour à la connexion</Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
