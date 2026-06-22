import { describe, expect, it } from "@jest/globals";
import { computeCommitHash, verifyCommit } from "./commit-hash.js";

describe("computeCommitHash", () => {
  it("hashes move and nonce with SHA256", () => {
    const hash = computeCommitHash("rock", "abc123");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(computeCommitHash("rock", "abc123"));
    expect(hash).not.toBe(computeCommitHash("paper", "abc123"));
  });
});

describe("verifyCommit", () => {
  it("returns match when commit matches reveal", () => {
    const nonce = "nonce-a";
    const commit = computeCommitHash("rock", nonce);
    expect(verifyCommit(commit, "rock", nonce)).toBe("match");
  });

  it("returns mismatch when commit does not match reveal", () => {
    expect(verifyCommit(computeCommitHash("rock", "nonce-a"), "paper", "nonce-a")).toBe("mismatch");
  });

  it("returns mismatch when commit, move or nonce is missing", () => {
    expect(verifyCommit(null, "rock", "nonce")).toBe("mismatch");
    expect(verifyCommit("abc", null, "nonce")).toBe("mismatch");
    expect(verifyCommit("abc", "rock", null)).toBe("mismatch");
  });
});
