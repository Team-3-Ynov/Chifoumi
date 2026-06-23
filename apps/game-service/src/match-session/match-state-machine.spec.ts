import type { MatchState } from "./match-session.types.js";
import { InvalidMatchTransitionError, transitionMatchState } from "./match-state-machine.js";

const baseState: MatchState = {
  matchId: "match-1",
  players: [
    { userId: "a", displayName: "Alice", rating: 1000 },
    { userId: "b", displayName: "Bob", rating: 1020 },
  ],
  scoreA: 0,
  scoreB: 0,
  currentRound: 1,
  status: "WAITING_PLAYS",
  startedAt: "2026-06-09T10:00:00.000Z",
  roundDeadline: "2026-06-09T10:00:05.000Z",
  roundPlays: { a: null, b: null },
};

describe("match state machine", () => {
  it("moves from WAITING_PLAYS to RESOLVING when both plays are received", () => {
    const next = transitionMatchState(baseState, { type: "PLAYS_RECEIVED" });

    expect(next.status).toBe("RESOLVING");
  });

  it("starts the next round after a non-final resolved round", () => {
    const resolving = transitionMatchState(baseState, { type: "PLAYS_RECEIVED" });
    const next = transitionMatchState(resolving, {
      type: "ROUND_RESOLVED",
      winner: "A",
      now: new Date("2026-06-09T10:00:01.000Z"),
    });

    expect(next).toMatchObject({
      status: "WAITING_PLAYS",
      scoreA: 1,
      scoreB: 0,
      currentRound: 2,
      roundDeadline: "2026-06-09T10:00:06.000Z",
      roundPlays: { a: null, b: null },
    });
  });

  it("advances the round without changing scores after a draw", () => {
    const resolving = transitionMatchState(baseState, { type: "PLAYS_RECEIVED" });
    const next = transitionMatchState(resolving, {
      type: "ROUND_RESOLVED",
      winner: "DRAW",
      now: new Date("2026-06-09T10:00:01.000Z"),
    });

    expect(next).toMatchObject({
      status: "WAITING_PLAYS",
      scoreA: 0,
      scoreB: 0,
      currentRound: 2,
      roundDeadline: "2026-06-09T10:00:06.000Z",
      roundPlays: { a: null, b: null },
    });
  });

  it("ends the match once a player reaches two wins", () => {
    const resolving: MatchState = {
      ...baseState,
      status: "RESOLVING",
      scoreA: 1,
      currentRound: 2,
    };
    const next = transitionMatchState(resolving, {
      type: "ROUND_RESOLVED",
      winner: "A",
      now: new Date("2026-06-09T10:00:04.000Z"),
    });

    expect(next).toMatchObject({
      status: "ENDED",
      scoreA: 2,
      winnerId: "a",
      endReason: "BEST_OF_3",
    });
  });

  it("ends in a draw after max rounds without a winner", () => {
    const resolving: MatchState = {
      ...baseState,
      status: "RESOLVING",
      scoreA: 1,
      scoreB: 1,
      currentRound: 5,
    };
    const next = transitionMatchState(resolving, {
      type: "ROUND_RESOLVED",
      winner: "DRAW",
      now: new Date("2026-06-09T10:00:20.000Z"),
    });

    expect(next).toMatchObject({
      status: "ENDED",
      endReason: "MAX_ROUNDS_DRAW",
      winnerId: undefined,
    });
  });

  it("ends the match by forfeit on waiting-play timeout", () => {
    const next = transitionMatchState(baseState, {
      type: "TIMEOUT",
      silentPlayer: "B",
      now: new Date("2026-06-09T10:00:06.000Z"),
    });

    expect(next).toMatchObject({
      status: "ENDED",
      winnerId: "a",
      endReason: "FORFEIT_TIMEOUT",
    });
  });

  it("ends the match by forfeit on waiting-commit timeout", () => {
    const waitingCommits: MatchState = {
      ...baseState,
      status: "WAITING_COMMITS",
      roundCommits: { a: "abc123", b: null },
    };
    const next = transitionMatchState(waitingCommits, {
      type: "TIMEOUT",
      silentPlayer: "B",
      now: new Date("2026-06-09T10:00:06.000Z"),
    });

    expect(next).toMatchObject({
      status: "ENDED",
      winnerId: "a",
      endReason: "FORFEIT_TIMEOUT",
    });
  });

  it("ends the match by forfeit on waiting-reveal timeout", () => {
    const waitingReveals: MatchState = {
      ...baseState,
      status: "WAITING_REVEALS",
      roundReveals: { a: "rock", b: null },
      revealDeadline: "2026-06-09T10:00:10.000Z",
    };
    const next = transitionMatchState(waitingReveals, {
      type: "TIMEOUT",
      silentPlayer: "B",
      now: new Date("2026-06-09T10:00:10.000Z"),
    });

    expect(next).toMatchObject({
      status: "ENDED",
      winnerId: "a",
      endReason: "FORFEIT_TIMEOUT",
    });
  });

  it("ends timeout without a winner when both players are silent", () => {
    const next = transitionMatchState(baseState, {
      type: "TIMEOUT",
      silentPlayer: "BOTH",
      now: new Date("2026-06-09T10:00:06.000Z"),
    });

    expect(next).toMatchObject({
      status: "ENDED",
      winnerId: undefined,
      endReason: "FORFEIT_TIMEOUT",
    });
  });

  it("rejects invalid transitions", () => {
    expect(() =>
      transitionMatchState(baseState, {
        type: "ROUND_RESOLVED",
        winner: "A",
        now: new Date("2026-06-09T10:00:04.000Z"),
      }),
    ).toThrow(InvalidMatchTransitionError);
  });
});
