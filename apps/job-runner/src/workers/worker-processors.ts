import type { Job } from "bullmq";
import type { WorkerQueueName } from "../config/env.js";
import {
  createMatchEndedProcessor,
  type MatchEventsProcessorDependencies,
} from "../match-events/match-ended.processor.js";
import type { MailService } from "../notifications/mail.service.js";
import { createNotificationsProcessor } from "../notifications/notifications.processor.js";
import {
  createSeasonResetProcessor,
  type SeasonResetProcessorDependencies,
} from "../seasons/season-reset.processor.js";
import {
  createGenerateBracketProcessor,
  type GenerateBracketProcessorDependencies,
} from "../tournaments/generate-bracket.processor.js";

export type WorkerProcessor = (job: Job) => Promise<void>;
export type ProcessorDependencies = MatchEventsProcessorDependencies &
  SeasonResetProcessorDependencies &
  GenerateBracketProcessorDependencies & {
    mailService: MailService;
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

  if (queue === "seasons") {
    return createSeasonResetProcessor(deps);
  }

  if (queue === "tournaments") {
    return createGenerateBracketProcessor(deps);
  }

  throw new Error(`Unsupported worker queue: ${queue satisfies never}`);
}
