import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MoveButtons } from "./MoveButtons.js";

describe("MoveButtons", () => {
  it("renders three move buttons", () => {
    render(<MoveButtons onPlay={() => undefined} />);

    expect(screen.getByRole("button", { name: "Pierre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feuille" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ciseaux" })).toBeInTheDocument();
  });

  it("calls onPlay with the selected move", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();

    render(<MoveButtons onPlay={onPlay} />);

    await user.click(screen.getByRole("button", { name: "Feuille" }));

    expect(onPlay).toHaveBeenCalledWith("PAPER");
  });

  it("disables buttons after a move is played", async () => {
    const user = userEvent.setup();

    render(<MoveButtons onPlay={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Pierre" }));

    expect(screen.getByRole("button", { name: "Pierre" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Feuille" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ciseaux" })).toBeDisabled();
  });
});
