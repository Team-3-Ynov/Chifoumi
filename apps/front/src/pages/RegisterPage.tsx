import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.js";
import { RegisterForm } from "../components/RegisterForm.js";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleRegister(values: { email: string; password: string; displayName: string }) {
    setApiError(null);

    try {
      await register(values.email, values.password, values.displayName);
      navigate("/lobby", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setApiError("Email déjà utilisé.");
      } else {
        setApiError(caught instanceof Error ? caught.message : "Inscription impossible.");
      }
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

        <RegisterForm onSubmit={handleRegister} apiError={apiError} />
      </section>
    </div>
  );
}
