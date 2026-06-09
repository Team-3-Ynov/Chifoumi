import { MatchEventBus } from "./match-event-bus.js";
import {
  MatchSessionLockError,
  MatchSessionNotFoundError,
  MatchSessionService,
} from "./match-session.service.js";
import {
  MATCH_SESSION_TTL_SECONDS,
  type MatchPlayer,
  matchChannel,
  matchLockKey,
  matchStateKey,
  userMatchKey,
} from "./match-session.types.js";

class FakeRedis {
  readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number>();
  readonly published: Array<{ channel: string; payload: string }> = [];
  lockedKeys = new Set<string>();
  releaseLockCalls: Array<{ key: string; token: string }> = [];
  setnxDelayMs = 0;
  setnxCalls = 0;

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.values.set(key, value);
    this.ttls.set(key, ttlSeconds);
  }

  async setnx(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    this.setnxCalls += 1;
    if (this.setnxDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.setnxDelayMs));
    }
    if (this.lockedKeys.has(key) || this.values.has(key)) {
      return false;
    }
    this.values.set(key, value);
    this.ttls.set(key, ttlSeconds);
    return true;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    this.releaseLockCalls.push({ key, token });
    if (this.values.get(key) !== token) {
      return false;
    }
    this.values.delete(key);
    return true;
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  async publish(channel: string, payload: string): Promise<void> {
    this.published.push({ channel, payload });
  }

  async subscribe(): Promise<void> {}
}

const players: [MatchPlayer, MatchPlayer] = [
  { userId: "a", displayName: "Alice", rating: 1000 },
  { userId: "b", displayName: "Bob", rating: 1020 },
];

describe("MatchSessionService", () => {
  let redis: FakeRedis;
  let service: MatchSessionService;

  beforeEach(() => {
    redis = new FakeRedis();
    const eventBus = new MatchEventBus(redis as never);
    service = new MatchSessionService(redis as never, eventBus);
  });

  it("creates a Redis-backed match state with a one-hour TTL and user mappings", async () => {
    const state = await service.create({
      matchId: "match-1",
      players,
      now: new Date("2026-06-09T10:00:00.000Z"),
    });

    expect(state).toMatchObject({
      matchId: "match-1",
      players,
      scoreA: 0,
      scoreB: 0,
      currentRound: 1,
      status: "WAITING_PLAYS",
      startedAt: "2026-06-09T10:00:00.000Z",
      roundDeadline: "2026-06-09T10:00:05.000Z",
      roundPlays: { a: null, b: null },
    });
    expect(JSON.parse(redis.values.get(matchStateKey("match-1")) ?? "{}")).toEqual(state);
    expect(redis.ttls.get(matchStateKey("match-1"))).toBe(MATCH_SESSION_TTL_SECONDS);
    expect(redis.values.get(userMatchKey("a"))).toBe("match-1");
    expect(redis.values.get(userMatchKey("b"))).toBe("match-1");
  });

  it("broadcasts matchFound for both players and roundStart on the match channel", async () => {
    await service.create({
      matchId: "match-1",
      players,
      now: new Date("2026-06-09T10:00:00.000Z"),
    });

    expect(redis.published.map((entry) => entry.channel)).toEqual([
      matchChannel("match-1"),
      matchChannel("match-1"),
      matchChannel("match-1"),
    ]);
    expect(redis.published.map((entry) => JSON.parse(entry.payload).event)).toEqual([
      "matchFound",
      "matchFound",
      "roundStart",
    ]);
    expect(redis.published.map((entry) => JSON.parse(entry.payload).recipientUserId)).toEqual([
      "a",
      "b",
      undefined,
    ]);
  });

  it("loads and mutates state under a Redis lock", async () => {
    await service.create({
      matchId: "match-1",
      players,
      now: new Date("2026-06-09T10:00:00.000Z"),
    });

    const next = await service.mutateState("match-1", (state) => ({
      ...state,
      status: "RESOLVING",
    }));

    expect(next.status).toBe("RESOLVING");
    expect(JSON.parse(redis.values.get(matchStateKey("match-1")) ?? "{}").status).toBe("RESOLVING");
    expect(redis.values.has(matchLockKey("match-1"))).toBe(false);
    expect(redis.releaseLockCalls).toHaveLength(1);
  });

  it("rejects mutations when another instance holds the lock", async () => {
    redis.lockedKeys.add(matchLockKey("match-1"));

    await expect(service.mutateState("match-1", (state) => state)).rejects.toBeInstanceOf(
      MatchSessionLockError,
    );
  });

  it("serializes concurrent mutations with the Redis lock", async () => {
    await service.create({
      matchId: "match-1",
      players,
      now: new Date("2026-06-09T10:00:00.000Z"),
    });
    redis.setnxDelayMs = 5;

    const results = await Promise.allSettled([
      service.mutateState("match-1", async (state) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { ...state, status: "RESOLVING" };
      }),
      service.mutateState("match-1", (state) => state),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(MatchSessionLockError),
    });
  });

  it("does not release a lock owned by another instance", async () => {
    await service.create({
      matchId: "match-1",
      players,
      now: new Date("2026-06-09T10:00:00.000Z"),
    });

    await expect(
      service.mutateState("match-1", (state) => {
        redis.values.set(matchLockKey("match-1"), "other-token");
        return { ...state, status: "RESOLVING" };
      }),
    ).resolves.toMatchObject({ status: "RESOLVING" });

    expect(redis.values.get(matchLockKey("match-1"))).toBe("other-token");
  });

  it("returns null for corrupt Redis state", async () => {
    redis.values.set(matchStateKey("match-1"), "{not-json");

    await expect(service.loadState("match-1")).resolves.toBeNull();
    await expect(service.mutateState("match-1", (state) => state)).rejects.toBeInstanceOf(
      MatchSessionNotFoundError,
    );
  });
});
