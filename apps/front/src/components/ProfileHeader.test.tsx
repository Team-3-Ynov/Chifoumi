import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProfileData } from "../hooks/useProfile.js";
import { ProfileHeader } from "./ProfileHeader.js";

const profile: ProfileData = {
  kind: "other",
  stats: {
    id: "player-1",
    displayName: "alice",
    rating: 1400,
    gamesPlayed: 12,
    league: { name: "Platinum", tier: 4 },
    winRate: 0.5,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
};

describe("ProfileHeader", () => {
  it("does not show next league progress for the top league", () => {
    render(<ProfileHeader profile={profile} progressToNextLeague={1} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Ligue maximale atteinte")).toBeInTheDocument();
  });
});
