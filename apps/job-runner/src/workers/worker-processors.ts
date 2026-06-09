import type { Job } from "bullmq";
import type { WorkerQueueName } from "../config/env.js";

export type WorkerProcessor = (job: Job) => Promise<void>;

const STUB_PROCESSORS: Record<WorkerQueueName, WorkerProcessor> = {
  "match-events": async (job) => {
    if (job.name !== "match-ended") {
      throw new Error(`Unsupported job name on match-events: ${job.name}`);
    }
  },
  notifications: async (job) => {
    if (job.name !== "send-mail") {
      throw new Error(`Unsupported job name on notifications: ${job.name}`);
    }
  },
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

export function getProcessorForQueue(queue: WorkerQueueName): WorkerProcessor {
  return STUB_PROCESSORS[queue];
}
