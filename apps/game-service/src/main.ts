import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOURNAMENTS_PROTO_PACKAGE, TOURNAMENTS_PROTO_PATH } from "@chifoumi/proto";
import { config as dotenvConfig } from "dotenv";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { resolveCorsOrigins } from "./cors.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

const DEFAULT_PORT = 3001;
const DEFAULT_GRPC_PORT = 50052;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS bootstrap, not React hooks
  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: resolveCorsOrigins(),
  });

  const grpcPort = Number(process.env.GAME_SERVICE_GRPC_PORT ?? DEFAULT_GRPC_PORT);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: TOURNAMENTS_PROTO_PACKAGE,
      protoPath: TOURNAMENTS_PROTO_PATH,
      url: `0.0.0.0:${grpcPort}`,
    },
  });
  await app.startAllMicroservices();

  const port = Number(process.env.GAME_SERVICE_PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
