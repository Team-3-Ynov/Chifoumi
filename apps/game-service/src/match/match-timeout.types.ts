export type MatchTimeoutExpectedState = "WAITING_PLAYS";

export type MatchTimeoutJobPayload = {
  matchId: string;
  roundNumber: number;
  expectedState: MatchTimeoutExpectedState;
};
