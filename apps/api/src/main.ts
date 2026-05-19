import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { resolveCorsOrigins } from "./cors.js";

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

  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
