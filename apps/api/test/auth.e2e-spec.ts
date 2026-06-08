import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

process.env.JWT_PRIVATE_KEY_PATH = resolve(
  repoRoot,
  process.env.JWT_PRIVATE_KEY_PATH ?? "infra/keys/jwt-private.pem",
);
process.env.JWT_PUBLIC_KEY_PATH = resolve(
  repoRoot,
  process.env.JWT_PUBLIC_KEY_PATH ?? "infra/keys/jwt-public.pem",
);

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    prisma = app.get(PrismaService);
    await prisma.refreshToken.deleteMany();
    await prisma.eloRating.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("POST /auth/register → 201, login → 200, GET /me → 200/401", async () => {
    const email = `user-${Date.now()}@example.com`;

    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email,
        password: "password1234",
        displayName: "player1",
      })
      .expect(201);

    expect(registerRes.body.user.role).toBe("player");
    expect(registerRes.body.tokens.access).toBeDefined();
    expect(registerRes.body.tokens.refresh).toBeDefined();

    const userRow = await prisma.user.findUnique({ where: { email } });
    expect(userRow?.passwordHash).toMatch(/^\$argon2id\$/);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "password1234" })
      .expect(200);

    const access = loginRes.body.tokens.access as string;

    await request(app.getHttpServer()).get("/me").expect(401);

    await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${access}`)
      .expect(200);
  });

  it("duplicate register → 409 with generic message", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password1234", displayName: "dupuser" })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password1234", displayName: "dupuser2" })
      .expect(409);

    expect(res.body.message).toBe("Unable to complete registration");
  });
});
