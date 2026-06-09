import type { Job } from "bullmq";
import type { WorkerQueueName } from "../config/env.js";
import {
  createMatchEndedProcessor,
  type MatchEventsProcessorDependencies,
} from "../match-events/match-ended.processor.js";

export type WorkerProcessor = (job: Job) => Promise<void>;
export type ProcessorDependencies = MatchEventsProcessorDependencies;

const STUB_PROCESSORS: Record<Exclude<WorkerQueueName, "match-events">, WorkerProcessor> = {
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

export function getProcessorForQueue(
  queue: WorkerQueueName,
  deps: ProcessorDependencies,
): WorkerProcessor {
  if (queue === "match-events") {
    return createMatchEndedProcessor(deps);
  }

  return STUB_PROCESSORS[queue];
}
