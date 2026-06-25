import { afterEach, describe, expect, it, jest } from "@jest/globals";
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

  it("uses a deterministic job id for tournament started mails", async () => {
    const queue = {
      add: jest.fn(async () => ({})),
    };
    const service = new NotificationsQueueService({
      REDIS_URL: "redis://localhost:6379",
      BULLMQ_PREFIX: "rps",
    } as never);
    (service as never as { queue: typeof queue }).queue = queue;

    await service.enqueueTournamentStartedMail({
      tournamentId: "44444444-4444-4444-8444-444444444444",
      userId: "11111111-1111-4111-8111-111111111111",
      to: "alice@test.com",
      displayName: "alice",
      tournamentName: "Spring Cup",
    });

    expect(queue.add).toHaveBeenCalledWith(
      "send-mail",
      {
        to: "alice@test.com",
        template: "tournament-started",
        data: {
          displayName: "alice",
          tournamentName: "Spring Cup",
        },
      },
      expect.objectContaining({
        jobId:
          "tournament-started:44444444-4444-4444-8444-444444444444:11111111-1111-4111-8111-111111111111",
      }),
    );
  });
});
