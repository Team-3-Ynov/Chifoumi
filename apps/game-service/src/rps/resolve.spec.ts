import { resolveRound } from "./resolve.js";

describe("resolveRound", () => {
  it("returns DRAW when both moves match", () => {
    expect(resolveRound("rock", "rock")).toBe("DRAW");
    expect(resolveRound("paper", "paper")).toBe("DRAW");
    expect(resolveRound("scissors", "scissors")).toBe("DRAW");
  });

  it("returns A when player A wins", () => {
    expect(resolveRound("rock", "scissors")).toBe("A");
    expect(resolveRound("paper", "rock")).toBe("A");
    expect(resolveRound("scissors", "paper")).toBe("A");
  });

  it("returns B when player B wins", () => {
    expect(resolveRound("scissors", "rock")).toBe("B");
    expect(resolveRound("rock", "paper")).toBe("B");
    expect(resolveRound("paper", "scissors")).toBe("B");
  });
});
