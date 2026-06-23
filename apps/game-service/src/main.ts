import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { resolveCorsOrigins } from "./cors.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS bootstrap, not React hooks
  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: resolveCorsOrigins(),
  });

  const port = Number(process.env.GAME_SERVICE_PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
