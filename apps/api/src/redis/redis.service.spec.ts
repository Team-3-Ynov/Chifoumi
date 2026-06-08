import { beforeEach, describe, expect, it } from "@jest/globals";
import Redis from "ioredis-mock";
import { LEADERBOARD_CACHE_KEY_PREFIX, RedisService } from "./redis.service.js";

describe("RedisService", () => {
  let service: RedisService;
  let client: InstanceType<typeof Redis>;

  beforeEach(() => {
    client = new Redis();
    service = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(service, { client, subscriber: new Redis() });
  });

  it("deletes all leaderboard cache keys on invalidation", async () => {
    await client.set(`${LEADERBOARD_CACHE_KEY_PREFIX}50`, "payload-50");
    await client.set(`${LEADERBOARD_CACHE_KEY_PREFIX}20`, "payload-20");
    await client.set("other:key", "keep-me");

    await service.invalidateLeaderboardCache();

    expect(await client.get(`${LEADERBOARD_CACHE_KEY_PREFIX}50`)).toBeNull();
    expect(await client.get(`${LEADERBOARD_CACHE_KEY_PREFIX}20`)).toBeNull();
    expect(await client.get("other:key")).toBe("keep-me");
  });

  it("blacklists and checks access tokens by jti", async () => {
    await service.revokeAccessToken("jti-1", 60);

    expect(await service.isAccessTokenRevoked("jti-1")).toBe(true);
    expect(await service.isAccessTokenRevoked("jti-2")).toBe(false);
  });
});
