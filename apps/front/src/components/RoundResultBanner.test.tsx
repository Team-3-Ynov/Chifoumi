import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoundResultBanner } from "./RoundResultBanner.js";

describe("RoundResultBanner", () => {
  it("shows the player win message", () => {
    render(<RoundResultBanner winner="a" />);
    expect(screen.getByText("Vous gagnez le round !")).toBeInTheDocument();
  });

  it("shows the opponent win message", () => {
    render(<RoundResultBanner winner="b" />);
    expect(screen.getByText("L'adversaire gagne le round.")).toBeInTheDocument();
  });

  it("shows the draw message", () => {
    render(<RoundResultBanner winner="draw" />);
    expect(screen.getByText("Round nul.")).toBeInTheDocument();
  });
});
