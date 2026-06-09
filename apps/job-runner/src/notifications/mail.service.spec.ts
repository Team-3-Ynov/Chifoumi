import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { JobRunnerConfig } from "../config/env.js";

const sendMail = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule("nodemailer", () => ({
  default: {
    createTransport: jest.fn(() => ({
      sendMail,
    })),
  },
}));

const { MailService: MailServiceClass } = await import("./mail.service.js");
const { TemplateService } = await import("./template.service.js");

function createConfig(): JobRunnerConfig {
  return {
    WORKER_QUEUES: ["notifications"],
    WORKER_CONCURRENCY: 4,
    WORKER_ROLE: "notifier",
    BULLMQ_PREFIX: "rps",
    REDIS_URL: "redis://localhost:6379",
    DATABASE_URL: "postgresql://app:password@localhost:5432/chifoumi",
    MAIL_TRANSPORT: "mailhog",
    MAIL_HOST: "localhost",
    MAIL_PORT: 1025,
    MAIL_FROM: "noreply@chifoumi.local",
    CRON_ENABLED: false,
  };
}

describe("MailService", () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "test-id" });
  });

  it("sends welcome mail with html and text bodies", async () => {
    const service = new MailServiceClass(createConfig(), new TemplateService());

    await service.send({
      to: "player@example.com",
      template: "welcome",
      data: { displayName: "alice" },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@chifoumi.local",
        to: "player@example.com",
        subject: "Bienvenue sur Chifoumi",
        html: expect.stringContaining("alice"),
        text: expect.stringContaining("alice"),
      }),
    );
  });

  it("propagates transport failures for BullMQ retry", async () => {
    sendMail.mockRejectedValue(new Error("SMTP connection refused"));
    const service = new MailServiceClass(createConfig(), new TemplateService());

    await expect(
      service.send({
        to: "player@example.com",
        template: "welcome",
        data: { displayName: "alice" },
      }),
    ).rejects.toThrow("SMTP connection refused");
  });

  it("throws a clear error when template is missing", async () => {
    const templateService = new TemplateService();
    const renderSpy = jest.spyOn(templateService, "render").mockImplementation(() => {
      throw new Error("Missing mail template file: welcome.html");
    });
    const service = new MailServiceClass(createConfig(), templateService);

    await expect(
      service.send({
        to: "player@example.com",
        template: "welcome",
        data: { displayName: "alice" },
      }),
    ).rejects.toThrow("Missing mail template file: welcome.html");

    renderSpy.mockRestore();
  });
});
