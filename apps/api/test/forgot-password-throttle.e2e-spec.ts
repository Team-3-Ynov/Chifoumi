// NB: the side-effect import below MUST stay first — it forces production
// throttler limits before app.module.ts / auth.controller.ts are evaluated.
import "./helpers/use-production-throttler.js";
import { generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { AuthService } from "../src/auth/auth.service.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

const jwtKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
process.env.DATABASE_URL ??= "postgresql://app:chifoumi_dev@localhost:5432/chifoumi";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.SKIP_DB_CONNECT = "true";
process.env.SKIP_REDIS_CONNECT = "true";
process.env.FRONTEND_URL ??= "http://localhost:5173";

describe("Forgot-password throttling (e2e, AC7)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // AuthService is stubbed so throttling is exercised without a database.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({ requestPasswordReset: async () => undefined })
      .compile();

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
    // Restore the Jest environment so the relaxed throttler limits apply to the
    // rest of the e2e suite.
    process.env.NODE_ENV = "test";
  });

  it("allows 3 requests then returns 429 on the 4th within the window", async () => {
    const email = "throttle@example.com";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer()).post("/auth/forgot-password").send({ email }).expect(200);
    }

    await request(app.getHttpServer()).post("/auth/forgot-password").send({ email }).expect(429);
  });
});
