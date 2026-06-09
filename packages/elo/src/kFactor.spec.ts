import { describe, expect, it } from "@jest/globals";
import { EloError } from "./elo-error.js";
import { getKFactor } from "./kFactor.js";

describe("getKFactor", () => {
  it("uses K=40 for beginners", () => {
    expect(getKFactor(1000, 0)).toBe(40);
    expect(getKFactor(1000, 29)).toBe(40);
  });

  it("uses K=32 for experienced players", () => {
    expect(getKFactor(1000, 30)).toBe(32);
    expect(getKFactor(2400, 300)).toBe(32);
  });

  it("uses K=16 above 2400 rating", () => {
    expect(getKFactor(2401, 30)).toBe(16);
    expect(getKFactor(9999, 1)).toBe(16);
  });

  it("throws an EloError for invalid rating or games played", () => {
    expect(() => getKFactor(-1, 10)).toThrow(EloError);
    expect(() => getKFactor(Number.NaN, 10)).toThrow(
      expect.objectContaining({ code: "INVALID_RATING" }),
    );
    expect(() => getKFactor(1000, -1)).toThrow(
      expect.objectContaining({ code: "INVALID_GAMES_PLAYED" }),
    );
  });
});
