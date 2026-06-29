import { describe, expect, it } from "@jest/globals";
import { softResetRating } from "./softResetRating.js";

describe("softResetRating", () => {
  it("pulls high ratings toward the baseline", () => {
    expect(softResetRating(1600)).toBe(1450);
  });

  it("pulls low ratings toward the baseline", () => {
    expect(softResetRating(800)).toBe(850);
  });

  it("keeps the starting rating unchanged", () => {
    expect(softResetRating(1000)).toBe(1000);
  });

  it("rounds to the nearest integer", () => {
    expect(softResetRating(1101)).toBe(1076);
  });
});
