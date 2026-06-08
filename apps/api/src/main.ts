import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { resolveCorsOrigins } from "./cors.js";
import { setupSwagger } from "./swagger.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

process.env.JWT_PRIVATE_KEY_PATH = resolve(
  repoRoot,
  process.env.JWT_PRIVATE_KEY_PATH ?? "infra/keys/jwt-private.pem",
);
process.env.JWT_PUBLIC_KEY_PATH = resolve(
  repoRoot,
  process.env.JWT_PUBLIC_KEY_PATH ?? "infra/keys/jwt-public.pem",
);

const DEFAULT_PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS bootstrap, not React hooks
  app.useLogger(app.get(Logger));
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS bootstrap, not React hooks
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: resolveCorsOrigins(),
  });
  setupSwagger(app);

  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
