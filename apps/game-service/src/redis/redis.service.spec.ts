import { beforeEach, describe, expect, it } from "@jest/globals";
import Redis from "ioredis-mock";
import { RedisService } from "./redis.service.js";

describe("RedisService", () => {
  let service: RedisService;
  let client: InstanceType<typeof Redis>;

  beforeEach(() => {
    client = new Redis();
    service = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(service, { client });
  });

  it("maps and reads a user socket", async () => {
    await service.setUserSocket("user-1", "socket-a");

    expect(await service.getUserSocket("user-1")).toBe("socket-a");
  });

  it("removes a user socket only when the stored socket id matches", async () => {
    await service.setUserSocket("user-1", "socket-a");

    await service.removeUserSocket("user-1", "socket-a");

    expect(await service.getUserSocket("user-1")).toBeNull();
  });

  it("does not delete a newer socket mapping when an older socket disconnects", async () => {
    await service.setUserSocket("user-1", "socket-a");
    await service.setUserSocket("user-1", "socket-b");

    await service.removeUserSocket("user-1", "socket-a");

    expect(await service.getUserSocket("user-1")).toBe("socket-b");
  });
});
