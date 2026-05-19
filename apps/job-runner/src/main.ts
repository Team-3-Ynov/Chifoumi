import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { RunnerService } from "./runner.service.js";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.get(RunnerService).markReady();

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
