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

export type MeProfile = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "admin";
  rating: number;
  gamesPlayed: number;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  winRate: number;
  createdAt: string;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
};

export type LeaderboardResponse = {
  items: LeaderboardEntry[];
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
