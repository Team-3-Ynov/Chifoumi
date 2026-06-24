import { afterEach, describe, expect, it } from "@jest/globals";
import { NotificationsQueueService } from "./notifications-queue.service.js";

describe("NotificationsQueueService", () => {
  afterEach(() => {
    delete process.env.SKIP_REDIS_CONNECT;
  });

  it("throws when enqueue is called without a connected queue", async () => {
    process.env.SKIP_REDIS_CONNECT = "true";
    const service = new NotificationsQueueService({
      REDIS_URL: "redis://localhost:6379",
      BULLMQ_PREFIX: "rps",
    } as never);
    service.onModuleInit();

    await expect(
      service.enqueueSeasonRewardMail({
        to: "player@test.com",
        displayName: "alice",
        seasonName: "Season 1",
        rank: "3",
        leagueName: "Gold",
        finalRating: "1200",
        delta: "+50",
      }),
    ).rejects.toThrow("Notifications queue is not connected");
  });
});
