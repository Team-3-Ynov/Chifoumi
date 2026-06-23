import { generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

const jwtKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const originalEnv = {
  JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY,
  JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  SKIP_DB_CONNECT: process.env.SKIP_DB_CONNECT,
  SKIP_REDIS_CONNECT: process.env.SKIP_REDIS_CONNECT,
};

process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
process.env.DATABASE_URL ??= "postgresql://app:chifoumi_dev@localhost:5432/chifoumi";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.SKIP_DB_CONNECT = "true";
process.env.SKIP_REDIS_CONNECT = "true";

describe("Metrics endpoint (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("returns Prometheus text metrics and records HTTP request counters", async () => {
    await request(app.getHttpServer()).get("/not-a-route").expect(404);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));

    const res = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("# HELP http_requests_total");
    expect(res.text).toContain('http_requests_total{method="GET",route="unmatched",status="404"}');
  });
});
