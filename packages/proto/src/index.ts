import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const AUTH_PROTO_PATH = join(packageRoot, "proto", "auth.proto");
export const AUTH_PROTO_PACKAGE = "chifoumi.auth.v1";

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
