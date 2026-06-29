import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenvConfig({ path: resolve(repoRoot, ".env") });
const DEFAULT_METRICS_PORT = 3002;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS bootstrap, not React hooks
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.JOB_RUNNER_METRICS_PORT ?? DEFAULT_METRICS_PORT));

  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    await app.close();
    process.exitCode = 0;
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void bootstrap();
