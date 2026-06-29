import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import "reflect-metadata";
import { AUTH_PROTO_PACKAGE, AUTH_PROTO_PATH } from "@chifoumi/proto";
import { NestFactory } from "@nestjs/core";
import { type MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

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

const DEFAULT_HTTP_PORT = 3006;
const DEFAULT_GRPC_PORT = 50054;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS bootstrap, not React hooks
  app.useLogger(app.get(Logger));

  const grpcPort = Number(process.env.AUTH_SERVICE_GRPC_PORT ?? DEFAULT_GRPC_PORT);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: AUTH_PROTO_PACKAGE,
      protoPath: AUTH_PROTO_PATH,
      url: `0.0.0.0:${grpcPort}`,
    },
  });
  await app.startAllMicroservices();

  const port = Number(process.env.AUTH_SERVICE_PORT ?? DEFAULT_HTTP_PORT);
  await app.listen(port);
}

void bootstrap();
