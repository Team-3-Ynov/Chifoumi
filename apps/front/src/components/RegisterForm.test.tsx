import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RegisterFormValues } from "../auth/authSchemas.js";
import { RegisterForm } from "./RegisterForm.js";

describe("RegisterForm", () => {
  it("shows validation errors before calling onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RegisterForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(await screen.findByText("Display name : 3 caractères minimum.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid values and disables the button while pending", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      (_values: RegisterFormValues) =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<RegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Display name"), "player1");
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "password1234");
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Création…" })).toBeDisabled();
    });

    resolveSubmit?.();

    await waitFor(() => {
      const submittedValues = onSubmit.mock.calls[0]?.[0] as RegisterFormValues | undefined;
      expect(submittedValues).toEqual({
        displayName: "player1",
        email: "player@example.com",
        password: "password1234",
      });
    });
  });

  it("displays API errors from the parent", () => {
    render(<RegisterForm onSubmit={vi.fn()} apiError="Email déjà utilisé" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Email déjà utilisé");
  });
});
