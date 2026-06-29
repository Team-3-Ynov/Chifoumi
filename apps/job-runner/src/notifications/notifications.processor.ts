import type { Job } from "bullmq";
import type { WorkerProcessor } from "../workers/worker-processors.js";
import type { MailService } from "./mail.service.js";
import type { SendMailJobPayload } from "./send-mail.types.js";

function isSendMailPayload(data: unknown): data is SendMailJobPayload {
  if (!data || typeof data !== "object") {
    return false;
  }

  const payload = data as Partial<SendMailJobPayload>;
  return (
    typeof payload.to === "string" &&
    typeof payload.template === "string" &&
    payload.data !== null &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  );
}

export function createNotificationsProcessor(mailService: MailService): WorkerProcessor {
  return async (job: Job) => {
    if (job.name !== "send-mail") {
      throw new Error(`Unsupported job name on notifications: ${job.name}`);
    }

    if (!isSendMailPayload(job.data)) {
      throw new Error("Invalid send-mail job payload");
    }

    await mailService.send(job.data);
  };
}
