import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type LoginFormValues, loginFormSchema } from "../auth/authSchemas.js";

type LoginFormProps = {
  onSubmit: (values: LoginFormValues) => Promise<void>;
  apiError?: string | null;
};

export function LoginForm({ onSubmit, apiError }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <span className="field-error" role="alert">
            {errors.email.message}
          </span>
        ) : null}
      </label>

      <label className="field">
        <span>Mot de passe</span>
        <input
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <span className="field-error" role="alert">
            {errors.password.message}
          </span>
        ) : null}
      </label>

      {apiError ? (
        <p className="form-error" role="alert">
          {apiError}
        </p>
      ) : null}

      <button type="submit" className="button" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
