import { createHash } from "node:crypto";

export type HashCheckResult = "match" | "mismatch";

export function computeCommitHash(move: string, nonce: string): string {
  return createHash("sha256").update(`${move}:${nonce}`).digest("hex");
}

export function verifyCommit(
  commit: string | null | undefined,
  move: string | null | undefined,
  nonce: string | null | undefined,
): HashCheckResult {
  if (!commit || !move || !nonce) {
    return "mismatch";
  }

  return computeCommitHash(move, nonce) === commit ? "match" : "mismatch";
}
