import type { Job } from "bullmq";
import type { WorkerQueueName } from "../config/env.js";
import {
  createMatchEndedProcessor,
  type MatchEventsProcessorDependencies,
} from "../match-events/match-ended.processor.js";
import type { MailService } from "../notifications/mail.service.js";
import { createNotificationsProcessor } from "../notifications/notifications.processor.js";

export type WorkerProcessor = (job: Job) => Promise<void>;
export type ProcessorDependencies = MatchEventsProcessorDependencies & {
  mailService: MailService;
};

const STUB_PROCESSORS: Record<
  Exclude<WorkerQueueName, "match-events" | "notifications">,
  WorkerProcessor
> = {
  seasons: async (job) => {
    if (job.name !== "season-reset") {
      throw new Error(`Unsupported job name on seasons: ${job.name}`);
    }
  },
  tournaments: async (job) => {
    if (job.name !== "generate-bracket") {
      throw new Error(`Unsupported job name on tournaments: ${job.name}`);
    }
  },
};

export function getProcessorForQueue(
  queue: WorkerQueueName,
  deps: ProcessorDependencies,
): WorkerProcessor {
  if (queue === "match-events") {
    return createMatchEndedProcessor(deps);
  }

  if (queue === "notifications") {
    return createNotificationsProcessor(deps.mailService);
  }

  return STUB_PROCESSORS[queue];
}
