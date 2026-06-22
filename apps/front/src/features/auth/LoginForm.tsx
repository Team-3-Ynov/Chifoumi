import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type LoginValues, loginSchema } from "../../validation/authSchemas.js";

type LoginFormProps = {
  onSubmit: (values: LoginValues) => Promise<void>;
  serverError?: string | null;
};

// Pure presentational form: validation via Zod + react-hook-form, submission and
// error handling are delegated to the parent through `onSubmit` / `serverError`.
export function LoginForm({ onSubmit, serverError }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <label className="auth-field">
        <span>Email</span>
        <input type="email" autoComplete="email" {...register("email")} />
        {errors.email ? <span className="auth-field__error">{errors.email.message}</span> : null}
      </label>

      <label className="auth-field">
        <span>Mot de passe</span>
        <input type="password" autoComplete="current-password" {...register("password")} />
        {errors.password ? (
          <span className="auth-field__error">{errors.password.message}</span>
        ) : null}
      </label>

      {serverError ? (
        <p className="auth-form__error" role="alert">
          {serverError}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
