import { generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { setupSwagger } from "../src/swagger.js";

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

describe("Swagger docs (e2e)", () => {
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
    setupSwagger(app);
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

  it("publishes OpenAPI JSON with tags, bearer auth and sprint-1 endpoints", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json").expect(200);

    expect(res.body.info).toMatchObject({
      title: "Chifoumi API",
      version: "1.0.0",
    });
    expect(res.body.components.securitySchemes["JWT-auth"]).toMatchObject({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        "/auth/register",
        "/auth/login",
        "/auth/refresh",
        "/auth/logout",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/me",
        "/me/history",
        "/users/{id}/profile",
        "/leaderboard",
      ]),
    );
    const tags = Object.values(res.body.paths)
      .flatMap((pathItem) => Object.values(pathItem as Record<string, { tags?: string[] }>))
      .flatMap((operation) => operation.tags ?? []);

    expect([...new Set(tags)]).toEqual(
      expect.arrayContaining(["auth", "me", "users", "leaderboard"]),
    );
  });
});
