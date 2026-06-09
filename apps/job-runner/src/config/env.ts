import { z } from "zod";

export const WORKER_QUEUE_NAMES = [
  "match-events",
  "notifications",
  "seasons",
  "tournaments",
] as const;

export type WorkerQueueName = (typeof WORKER_QUEUE_NAMES)[number];

export const WORKER_ROLES = ["match-processor", "notifier", "cron", "bracket-generator"] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];

const envSchema = z.object({
  WORKER_QUEUES: z
    .string()
    .min(1, "WORKER_QUEUES is required")
    .transform((value) =>
      value
        .split(",")
        .map((queue) => queue.trim())
        .filter((queue) => queue.length > 0),
    )
    .pipe(
      z
        .array(z.enum(WORKER_QUEUE_NAMES))
        .min(1, "WORKER_QUEUES must contain at least one valid queue"),
    ),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_ROLE: z.enum(WORKER_ROLES).default("match-processor"),
  BULLMQ_PREFIX: z.string().min(1).default("rps"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  MAIL_TRANSPORT: z.enum(["smtp", "mailhog"]).default("mailhog"),
  MAIL_HOST: z.string().min(1).default("localhost"),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().email().default("noreply@chifoumi.local"),
  CRON_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type JobRunnerConfig = z.infer<typeof envSchema>;

export const JOB_RUNNER_CONFIG = Symbol("JOB_RUNNER_CONFIG");

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): JobRunnerConfig {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");

    console.error(`[job-runner] Invalid environment configuration:\n${messages}`);
    process.exit(1);
  }

  return result.data;
}
