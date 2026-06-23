import { describe, expect, it } from "vitest";
import { formatRatingDelta } from "./formatRating.js";

describe("formatRatingDelta", () => {
  it("formats positive deltas with a plus sign and positive tone", () => {
    expect(formatRatingDelta(16)).toEqual({
      text: "+16",
      tone: "positive",
      className: "delta-positive",
    });
  });

  it("formats negative deltas with negative tone", () => {
    expect(formatRatingDelta(-16)).toEqual({
      text: "-16",
      tone: "negative",
      className: "delta-negative",
    });
  });

  it("formats zero as neutral", () => {
    expect(formatRatingDelta(0)).toEqual({
      text: "+0",
      tone: "neutral",
      className: "delta-neutral",
    });
  });
});
