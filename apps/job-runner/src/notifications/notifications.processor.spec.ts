import { describe, expect, it, jest } from "@jest/globals";
import type { Job } from "bullmq";
import type { MailService } from "./mail.service.js";
import { createNotificationsProcessor } from "./notifications.processor.js";

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    name: "send-mail",
    data: {
      to: "player@example.com",
      template: "welcome",
      data: { displayName: "alice" },
    },
    ...overrides,
  } as Job;
}

describe("createNotificationsProcessor", () => {
  it("delegates valid send-mail jobs to MailService", async () => {
    const mailService = {
      send: jest.fn<MailService["send"]>().mockResolvedValue(),
    };
    const processor = createNotificationsProcessor(mailService as unknown as MailService);

    await processor(createJob());

    expect(mailService.send).toHaveBeenCalledWith({
      to: "player@example.com",
      template: "welcome",
      data: { displayName: "alice" },
    });
  });

  it("rejects unsupported job names", async () => {
    const mailService = {
      send: jest.fn<MailService["send"]>(),
    };
    const processor = createNotificationsProcessor(mailService as unknown as MailService);

    await expect(processor(createJob({ name: "other-job" }))).rejects.toThrow(
      "Unsupported job name on notifications: other-job",
    );
  });

  it("rejects invalid payloads", async () => {
    const mailService = {
      send: jest.fn<MailService["send"]>(),
    };
    const processor = createNotificationsProcessor(mailService as unknown as MailService);

    await expect(processor(createJob({ data: { invalid: true } }))).rejects.toThrow(
      "Invalid send-mail job payload",
    );
  });
});
