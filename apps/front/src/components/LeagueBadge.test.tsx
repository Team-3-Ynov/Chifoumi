import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeagueBadge } from "./LeagueBadge.js";

const tiers = [
  { name: "Bronze", tier: 1 },
  { name: "Silver", tier: 2 },
  { name: "Gold", tier: 3 },
  { name: "Platinum", tier: 4 },
];

describe("LeagueBadge", () => {
  it.each(tiers)("renders the $name tier indicator", ({ name, tier }) => {
    render(<LeagueBadge name={name} tier={tier} />);

    const badge = screen.getByText(name).closest(".league-badge");

    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText(`, palier ${name}`)).toBeInTheDocument();
    expect(badge).toHaveClass(`league-badge-tier-${tier}`);
    expect(badge).toHaveAttribute("data-tier", String(tier));
  });
});
