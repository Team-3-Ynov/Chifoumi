export type TournamentProgressionResult =
  | "not_tournament_match"
  | "no_winner"
  | "already_advanced"
  | "advanced"
  | "tournament_completed";

export type TournamentMatchReadyInput = {
  tournamentMatchId: string;
  tournamentName: string;
  slotA: { userId: string; displayName: string; email: string };
  slotB: { userId: string; displayName: string; email: string };
};
