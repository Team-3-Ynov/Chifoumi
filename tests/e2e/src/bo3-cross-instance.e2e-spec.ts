/**
 * @e2e US-031 — BO3 smoke test across two Game Service replicas.
 */
import {
  createPlayer,
  getMe,
  pollMe,
  type RegisteredPlayer,
  waitForHealth,
} from "./helpers/http.js";
import {
  connectAuthenticated,
  joinQueue,
  type MatchFoundPayload,
  playBo3Win,
  type RoundStartPayload,
  waitForEvent,
} from "./helpers/ws.js";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const game1Url = process.env.E2E_GAME_1_URL ?? "http://127.0.0.1:3101";
const game2Url = process.env.E2E_GAME_2_URL ?? "http://127.0.0.1:3102";

describe("US-031 BO3 cross-instance smoke @e2e", () => {
  let playerA: RegisteredPlayer;
  let playerB: RegisteredPlayer;

  beforeAll(async () => {
    await Promise.all([waitForHealth(apiUrl), waitForHealth(game1Url), waitForHealth(game2Url)]);

    playerA = await createPlayer(apiUrl, "a");
    playerB = await createPlayer(apiUrl, "b");
  }, 90_000);

  it("plays a full BO3 on different game replicas and persists results", async () => {
    const { socket: socketA } = await connectAuthenticated(game1Url, playerA.tokens.access);
    const { socket: socketB } = await connectAuthenticated(game2Url, playerB.tokens.access);

    const baselineA = await getMe(apiUrl, playerA.tokens.access);

    const matchFoundA = waitForEvent<MatchFoundPayload>(socketA, "matchFound");
    const matchFoundB = waitForEvent<MatchFoundPayload>(socketB, "matchFound");
    const roundStartA = waitForEvent<RoundStartPayload>(socketA, "roundStart");
    const roundStartB = waitForEvent<RoundStartPayload>(socketB, "roundStart");

    await joinQueue(socketA);
    await joinQueue(socketB);

    const payloadA = await matchFoundA;
    const payloadB = await matchFoundB;
    const roundStart = await roundStartA;
    await roundStartB;

    expect(payloadA.matchId).toBe(payloadB.matchId);
    expect(payloadA.bestOf).toBe(3);

    const { matchEndedA, matchEndedB } = await playBo3Win(
      socketA,
      socketB,
      payloadA.matchId,
      roundStart,
    );

    expect(matchEndedA.winner).toBe(playerA.userId);
    expect(matchEndedB.winner).toBe(playerA.userId);
    expect(matchEndedA.finalScore).toEqual({ a: 2, b: 0 });

    const profileA = await pollMe(
      apiUrl,
      playerA.tokens.access,
      (profile) => profile.gamesPlayed === 1 && profile.rating > baselineA.rating,
    );
    expect(profileA.gamesPlayed).toBe(1);

    const leaderboardResponse = await fetch(`${apiUrl}/leaderboard?limit=10`);
    expect(leaderboardResponse.ok).toBe(true);
    const leaderboard = (await leaderboardResponse.json()) as {
      items: Array<{ userId: string; rating: number }>;
    };
    expect(leaderboard.items[0]?.userId).toBe(playerA.userId);
    expect(leaderboard.items[0]?.rating).toBeGreaterThan(
      leaderboard.items.find((entry) => entry.userId === playerB.userId)?.rating ?? 0,
    );

    const historyResponse = await fetch(`${apiUrl}/me/history?limit=10`, {
      headers: { authorization: `Bearer ${playerB.tokens.access}` },
    });
    expect(historyResponse.ok).toBe(true);
    const history = (await historyResponse.json()) as {
      items: Array<{ matchId: string; isWinner: boolean }>;
    };
    const historyItem = history.items.find((item) => item.matchId === payloadA.matchId);
    expect(historyItem).toBeDefined();
    expect(historyItem?.isWinner).toBe(false);

    socketA.disconnect();
    socketB.disconnect();
  }, 30_000);
});
