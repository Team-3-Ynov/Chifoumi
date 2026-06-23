import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LoginFormValues } from "../auth/authSchemas.js";
import { LoginForm } from "./LoginForm.js";

describe("LoginForm", () => {
  it("shows validation errors before calling onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Email invalide.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid credentials and disables the button while pending", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      (_values: LoginFormValues) =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "secret123");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Connexion…" })).toBeDisabled();
    });

    resolveSubmit?.();

    await waitFor(() => {
      const submittedValues = onSubmit.mock.calls[0]?.[0] as LoginFormValues | undefined;
      expect(submittedValues).toEqual({
        email: "player@example.com",
        password: "secret123",
      });
    });
  });

  it("displays API errors from the parent", () => {
    render(<LoginForm onSubmit={vi.fn()} apiError="Identifiants invalides" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Identifiants invalides");
  });
});
