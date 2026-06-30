import type { LeagueSummary } from "@chifoumi/leagues";
import type { UserRole } from "@chifoumi/proto";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
};

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  gamesPlayed: number;
  createdAt: Date;
};

export type AdminUsersPage = {
  items: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
};

export type PublicUserProfile = {
  id: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  league: LeagueSummary;
  winRate: number;
  createdAt: Date;
};

export type CurrentUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  gamesPlayed: number;
  league: LeagueSummary;
  createdAt: Date;
};
