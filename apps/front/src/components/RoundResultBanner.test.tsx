import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoundResultBanner } from "./RoundResultBanner.js";

const baseResult = {
  matchId: "match-1",
  roundNumber: 1,
  yourMove: "rock" as const,
  theirMove: "scissors" as const,
  winner: "a" as const,
  scoreA: 1,
  scoreB: 0,
};

describe("RoundResultBanner", () => {
  it("shows the player win message", () => {
    render(<RoundResultBanner result={baseResult} />);
    expect(screen.getByText("Vous gagnez le round !")).toBeInTheDocument();
  });

  it("shows the opponent loss message", () => {
    render(
      <RoundResultBanner
        result={{ ...baseResult, yourMove: "rock", theirMove: "paper", winner: "b" }}
      />,
    );
    expect(screen.getByText("Vous perdez le round.")).toBeInTheDocument();
  });

  it("shows the draw message", () => {
    render(
      <RoundResultBanner
        result={{ ...baseResult, yourMove: "rock", theirMove: "rock", winner: "draw" }}
      />,
    );
    expect(screen.getByText("Égalité sur ce round.")).toBeInTheDocument();
  });
});
