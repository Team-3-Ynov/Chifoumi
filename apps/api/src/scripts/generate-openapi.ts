import "reflect-metadata";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { buildSwaggerDocument } from "../swagger.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const outputPath = resolve(repoRoot, "docs/openapi.json");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

process.env.JWT_PRIVATE_KEY = privateKey;
process.env.JWT_PUBLIC_KEY = publicKey;
process.env.DATABASE_URL ??= "postgresql://app:chifoumi_dev@localhost:5432/chifoumi";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.SKIP_DB_CONNECT = "true";
process.env.SKIP_REDIS_CONNECT = "true";

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildSwaggerDocument(app);
  mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await app.close();
}

generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
