import { describe, expect, it, jest } from "@jest/globals";
import { type Job, UnrecoverableError } from "bullmq";
import { createGenerateBracketProcessor } from "./generate-bracket.processor.js";

const validPayload = {
  tournamentId: "44444444-4444-4444-8444-444444444444",
};

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    name: "generate-bracket",
    data: validPayload,
    ...overrides,
  } as Job;
}

describe("createGenerateBracketProcessor", () => {
  it("processes valid generate-bracket jobs", async () => {
    const generateBracket = {
      processGenerateBracket: jest.fn(async () => "generated"),
    };
    const processor = createGenerateBracketProcessor({
      generateBracket: generateBracket as never,
    });

    await processor(createJob());

    expect(generateBracket.processGenerateBracket).toHaveBeenCalledWith(validPayload);
  });

  it("rejects invalid payloads without retry", async () => {
    const processor = createGenerateBracketProcessor({
      generateBracket: { processGenerateBracket: jest.fn() } as never,
    });

    await expect(processor(createJob({ data: { invalid: true } }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("rejects unsupported job names without retry", async () => {
    const processor = createGenerateBracketProcessor({
      generateBracket: { processGenerateBracket: jest.fn() } as never,
    });

    await expect(processor(createJob({ name: "other-job" }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("propagates service failures so BullMQ can retry", async () => {
    const error = new Error("database unavailable");
    const processor = createGenerateBracketProcessor({
      generateBracket: {
        processGenerateBracket: jest.fn(async () => {
          throw error;
        }),
      } as never,
    });

    await expect(processor(createJob())).rejects.toBe(error);
  });
});
