export type LeagueFilter = "bronze" | "silver" | "gold" | "platinum";

export const LEAGUE_FILTERS: { label: string; value: LeagueFilter | "" }[] = [
  { label: "Toutes", value: "" },
  { label: "Bronze", value: "bronze" },
  { label: "Silver", value: "silver" },
  { label: "Gold", value: "gold" },
  { label: "Platinum", value: "platinum" },
];
