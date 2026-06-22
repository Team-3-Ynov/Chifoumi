import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type RegisterFormValues, registerFormSchema } from "../auth/authSchemas.js";

type RegisterFormProps = {
  onSubmit: (values: RegisterFormValues) => Promise<void>;
  apiError?: string | null;
};

export function RegisterForm({ onSubmit, apiError }: RegisterFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <label className="field">
        <span>Display name</span>
        <input
          type="text"
          autoComplete="username"
          aria-invalid={Boolean(errors.displayName)}
          {...register("displayName")}
        />
        {errors.displayName ? (
          <span className="field-error" role="alert">
            {errors.displayName.message}
          </span>
        ) : null}
      </label>

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
          autoComplete="new-password"
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
        {isSubmitting ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}
