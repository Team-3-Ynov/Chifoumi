import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { BracketRound } from "../api/types.js";
import { BracketView } from "./BracketView.js";

function makeBracket(): BracketRound[] {
  return [
    {
      round: 1,
      matches: [
        {
          id: "m1",
          matchId: "match-1",
          slotA: { userId: "u1", displayName: "alice" },
          slotB: { userId: "u2", displayName: "bob" },
          scoreA: 2,
          scoreB: 1,
          winnerSlot: "a",
        },
        {
          id: "m2",
          matchId: "match-2",
          slotA: { userId: "u3", displayName: "carol" },
          slotB: { userId: "u4", displayName: "dan" },
          scoreA: null,
          scoreB: null,
          winnerSlot: null,
        },
        {
          id: "bye1",
          matchId: null,
          slotA: { userId: "u5", displayName: "eve" },
          slotB: null,
          scoreA: null,
          scoreB: null,
          winnerSlot: null,
        },
      ],
    },
    {
      round: 2,
      matches: [
        {
          id: "m3",
          matchId: null,
          slotA: { userId: "u1", displayName: "alice" },
          slotB: null,
          scoreA: null,
          scoreB: null,
          winnerSlot: null,
        },
      ],
    },
  ];
}

function renderBracket(currentUserId?: string) {
  return render(
    <MemoryRouter>
      <BracketView bracket={makeBracket()} currentUserId={currentUserId} />
    </MemoryRouter>,
  );
}

describe("BracketView", () => {
  it("renders every round side by side with its label", () => {
    renderBracket();
    expect(screen.getByRole("heading", { name: "Demi-finales" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Finale" })).toBeInTheDocument();
  });

  it("shows player names, the score when played and 'À déterminer' for empty slots", () => {
    renderBracket();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("À déterminer")).toBeInTheDocument();
  });

  it("highlights the winning slot", () => {
    const { container } = renderBracket();
    const winnerNames = Array.from(container.querySelectorAll(".bracket-slot-winner")).map(
      (slot) => slot.querySelector(".bracket-slot-name")?.textContent,
    );
    expect(winnerNames).toContain("alice");

    const bobSlot = Array.from(container.querySelectorAll(".bracket-slot")).find((slot) =>
      slot.textContent?.includes("bob"),
    );
    expect(bobSlot).not.toHaveClass("bracket-slot-winner");
  });

  it("renders round-1 byes explicitly", () => {
    renderBracket();
    expect(screen.getByText("eve")).toBeInTheDocument();
    expect(screen.getByText("Qualifié d’office")).toBeInTheDocument();
  });

  it("shows a 'Jouer' CTA only for the current player's ready match", () => {
    renderBracket("u3");
    const cta = screen.getByRole("link", { name: "Jouer" });
    expect(cta).toHaveAttribute("href", "/match/match-2");
  });

  it("hides the CTA for spectators and finished matches", () => {
    renderBracket();
    expect(screen.queryByRole("link", { name: "Jouer" })).not.toBeInTheDocument();

    renderBracket("u1");
    expect(screen.queryByRole("link", { name: "Jouer" })).not.toBeInTheDocument();
  });
});
