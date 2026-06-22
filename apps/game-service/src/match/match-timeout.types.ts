export type MatchTimeoutExpectedState = "WAITING_PLAYS" | "WAITING_COMMITS" | "WAITING_REVEALS";

export type MatchTimeoutJobPayload = {
  matchId: string;
  roundNumber: number;
  expectedState: MatchTimeoutExpectedState;
};
