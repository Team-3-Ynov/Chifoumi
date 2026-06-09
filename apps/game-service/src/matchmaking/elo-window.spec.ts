import { describe, expect, it } from "@jest/globals";
import { getEloWindow, ratingsMatch } from "./elo-window.js";

describe("getEloWindow", () => {
  it("returns ±50 before 10 seconds", () => {
    expect(getEloWindow(0)).toBe(50);
    expect(getEloWindow(9_999)).toBe(50);
  });

  it("returns ±100 between 10 and 30 seconds", () => {
    expect(getEloWindow(10_000)).toBe(100);
    expect(getEloWindow(29_999)).toBe(100);
  });

  it("returns ±200 between 30 and 60 seconds", () => {
    expect(getEloWindow(30_000)).toBe(200);
    expect(getEloWindow(59_999)).toBe(200);
  });

  it("returns unlimited after 60 seconds", () => {
    expect(getEloWindow(60_000)).toBe(Number.POSITIVE_INFINITY);
    expect(getEloWindow(120_000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("ratingsMatch", () => {
  it("matches players within the wider window", () => {
    expect(ratingsMatch(1000, 1040, 50, 50)).toBe(true);
    expect(ratingsMatch(1000, 1060, 50, 50)).toBe(false);
  });

  it("uses the wider of two player windows", () => {
    expect(ratingsMatch(1000, 1080, 50, 100)).toBe(true);
    expect(ratingsMatch(1000, 1101, 50, 100)).toBe(false);
  });

  it("matches any ratings when a window is unlimited", () => {
    expect(ratingsMatch(800, 1500, 50, Number.POSITIVE_INFINITY)).toBe(true);
  });
});
