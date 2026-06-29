import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const AUTH_PROTO_PATH = join(packageRoot, "proto", "auth.proto");
export const AUTH_PROTO_PACKAGE = "chifoumi.auth.v1";

export const TOURNAMENTS_PROTO_PATH = join(packageRoot, "proto", "tournaments.proto");
export const TOURNAMENTS_PROTO_PACKAGE = "chifoumi.tournaments.v1";

export type VerifyTokenReason = "INVALID" | "EXPIRED" | "REVOKED" | "UNAVAILABLE";

export type VerifyTokenResponse = {
  valid: boolean;
  userId?: string;
  role?: string;
  displayName?: string;
  reason?: VerifyTokenReason;
  jti?: string;
};

export type GetRatingResponse = {
  rating: number;
  gamesPlayed: number;
};

export type UserRole = "player" | "admin";

export type UserRecordResponse = {
  found: boolean;
  id?: string;
  email?: string;
  passwordHash?: string;
  displayName?: string;
  role?: UserRole;
  createdAt?: string;
};

export type LeagueSummaryMessage = {
  name: string;
  tier: number;
};

export type CurrentUserProfileResponse = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  gamesPlayed: number;
  league: LeagueSummaryMessage;
  createdAt: string;
};

export type PublicUserProfileResponse = {
  id: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  league: LeagueSummaryMessage;
  winRate: number;
  createdAt: string;
};

export type AdminUserSummaryMessage = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  gamesPlayed: number;
  createdAt: string;
};

export type ListUsersResponse = {
  items: AdminUserSummaryMessage[];
  total: number;
  page: number;
  limit: number;
};
