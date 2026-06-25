export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type AuthResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type RefreshResponse = {
  tokens: AuthTokens;
};

export type LeagueSummary = {
  name: string;
  tier: number;
};

export type CurrentSeason = {
  id: string;
  name: string;
  startedAt: string;
  endsAt: string | null;
  status: "upcoming" | "active" | "closed";
};

export type CurrentSeasonMe = {
  rating: number;
  league: LeagueSummary;
  rank: number;
  progressToNextLeague: number;
};

export type CurrentSeasonResponse = {
  season: CurrentSeason;
  me: CurrentSeasonMe;
};

export type MeProfile = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
  rating: number;
  gamesPlayed: number;
  league: LeagueSummary;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  league: LeagueSummary;
  winRate: number;
  createdAt: string;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  league: LeagueSummary;
};

export type LeaderboardResponse = {
  items: LeaderboardEntry[];
};

export type SeasonStandingsSeason = {
  id: string;
  name: string;
  status: "upcoming" | "active" | "closed";
};

export type SeasonStandingEntry = {
  rank: number;
  userId: string;
  displayName: string;
  finalRating: number;
  finalLeague: LeagueSummary;
};

export type SeasonStandingsResponse = {
  season: SeasonStandingsSeason;
  items: SeasonStandingEntry[];
  total: number;
  page: number;
  limit: number;
};

export type ClosedSeasonSummary = {
  id: string;
  name: string;
  startedAt: string;
  endsAt: string | null;
  status: "closed";
};

export type ClosedSeasonsResponse = {
  items: ClosedSeasonSummary[];
};

export type MeHistoryOpponent = {
  displayName: string;
  ratingAtMatch: number;
};

export type MeHistoryItem = {
  matchId: string;
  opponent: MeHistoryOpponent;
  scoreA: number;
  scoreB: number;
  isWinner: boolean;
  eloDelta: number;
  endedAt: string;
};

export type MeHistoryResponse = {
  items: MeHistoryItem[];
  nextCursor: string | null;
};

export type TournamentFormat = "single_elim" | "double_elim";

export type TournamentStatus = "upcoming" | "registration_open" | "in_progress" | "completed";

export type TournamentSummary = {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  bracketSize: number;
  registrationsCount: number;
  startsAt: string;
};

export type TournamentListResponse = {
  items: TournamentSummary[];
  page: number;
  limit: number;
  total: number;
};

export type TournamentRegistration = {
  userId: string;
  displayName: string;
  seed: number | null;
};

export type BracketSlot = {
  userId: string;
  displayName: string;
};

export type WinnerSlot = "a" | "b";

export type BracketMatch = {
  id: string;
  matchId: string | null;
  slotA: BracketSlot | null;
  slotB: BracketSlot | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerSlot: WinnerSlot | null;
};

export type BracketRound = {
  round: number;
  matches: BracketMatch[];
};

export type TournamentDetail = TournamentSummary & {
  registrationOpensAt: string;
  endedAt: string | null;
  registrations: TournamentRegistration[];
  bracket: BracketRound[];
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
  rating: number;
  gamesPlayed: number;
  createdAt: string;
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

export type AuditHashCheck = {
  a: "match" | "mismatch";
  b: "match" | "mismatch";
};

export type AuditRound = {
  roundNumber: number;
  commitA: string | null;
  commitB: string | null;
  moveA: "rock" | "paper" | "scissors" | null;
  moveB: "rock" | "paper" | "scissors" | null;
  nonceA: string | null;
  nonceB: string | null;
  hashCheck: AuditHashCheck;
};

export type MatchAuditPlayer = {
  id: string;
  displayName: string;
};

export type MatchAuditResponse = {
  matchId: string;
  players: MatchAuditPlayer[];
  rounds: AuditRound[];
  finalScore: [number, number];
  winner: string | null;
  endedAt: string;
};
