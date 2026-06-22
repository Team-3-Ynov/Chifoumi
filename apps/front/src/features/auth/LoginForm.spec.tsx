import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm.js";

describe("LoginForm (AC3, AC7)", () => {
  it("shows a validation error for an invalid email and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/mot de passe/i), "whatever");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByText("Format d'email invalide")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the credentials when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "password1234");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({ email: "a@b.com", password: "password1234" });
  });

  it("renders a server error message (AC3)", () => {
    render(<LoginForm onSubmit={vi.fn()} serverError="Identifiants invalides" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Identifiants invalides");
  });
});
