import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { resolveAuthErrorMessage } from "../api/apiError.js";
import { useAuth } from "../auth/AuthContext.js";
import { RegisterForm } from "../features/auth/RegisterForm.js";
import type { RegisterValues } from "../validation/authSchemas.js";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: RegisterValues) {
    setServerError(null);
    try {
      await register(values);
      navigate("/lobby", { replace: true });
    } catch (error) {
      setServerError(
        resolveAuthErrorMessage(
          error,
          { 409: "Email déjà utilisé", 400: "Données invalides" },
          "Inscription impossible. Veuillez réessayer.",
        ),
      );
    }
  }

  return (
    <div className="auth-page">
      <h1>Créer un compte</h1>
      <RegisterForm onSubmit={handleSubmit} serverError={serverError} />
      <p className="auth-page__switch">
        Déjà inscrit ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  );
}
