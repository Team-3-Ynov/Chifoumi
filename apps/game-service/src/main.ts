import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { resolveCorsOrigins } from "./cors.js";

const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: resolveCorsOrigins(),
  });

  const port = Number(process.env.GAME_SERVICE_PORT ?? DEFAULT_PORT);
  await app.listen(port);
  console.log(`[game-service] ready on port ${port}`);
}

void bootstrap();
