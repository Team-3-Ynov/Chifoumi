import { type Job, UnrecoverableError } from "bullmq";
import type { WorkerProcessor } from "../workers/worker-processors.js";
import type { GenerateBracketService } from "./generate-bracket.service.js";
import { generateBracketPayloadSchema } from "./generate-bracket.types.js";

export type GenerateBracketProcessorDependencies = {
  generateBracket: GenerateBracketService;
};

export function createGenerateBracketProcessor(
  deps: GenerateBracketProcessorDependencies,
): WorkerProcessor {
  return async (job: Job) => {
    if (job.name !== "generate-bracket") {
      throw new UnrecoverableError(`Unsupported job name on tournaments: ${job.name}`);
    }

    const parsed = generateBracketPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError("Invalid generate-bracket job payload");
    }

    await deps.generateBracket.processGenerateBracket(parsed.data);
  };
}
