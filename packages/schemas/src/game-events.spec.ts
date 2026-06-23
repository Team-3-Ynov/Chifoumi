import { describe, expect, it } from "@jest/globals";
import {
  matchEndedPayloadSchema,
  matchFoundPayloadSchema,
  playPayloadSchema,
  roundStartPayloadSchema,
} from "./game-events.js";

describe("game event schemas", () => {
  it("parses the payloads used to start a match", () => {
    expect(
      matchFoundPayloadSchema.parse({
        matchId: "match-1",
        opponent: { userId: "player-b", displayName: "Bob", rating: 1040 },
        bestOf: 3,
      }),
    ).toMatchObject({ matchId: "match-1", bestOf: 3 });

    expect(
      roundStartPayloadSchema.parse({
        matchId: "match-1",
        roundNumber: 1,
        deadline: "2026-06-22T13:00:05.000Z",
      }),
    ).toMatchObject({ roundNumber: 1 });
  });

  it("rejects an unsupported move before it reaches the socket", () => {
    expect(() =>
      playPayloadSchema.parse({
        matchId: "match-1",
        roundNumber: 1,
        move: "lizard",
      }),
    ).toThrow();
  });

  it("parses a timeout result", () => {
    expect(
      matchEndedPayloadSchema.parse({
        matchId: "match-1",
        winner: "player-b",
        finalScore: { a: 0, b: 1 },
        eloDelta: { a: -16, b: 16 },
        reason: "FORFEIT_TIMEOUT",
      }).reason,
    ).toBe("FORFEIT_TIMEOUT");
  });
});
