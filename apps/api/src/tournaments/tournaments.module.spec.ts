import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import { AppConfigModule } from "../config/config.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueuesModule } from "../queues/queues.module.js";
import { TournamentsModule } from "./tournaments.module.js";
import { TournamentsService } from "./tournaments.service.js";

describe("TournamentsModule wiring", () => {
  const previousPrivateKey = process.env.JWT_PRIVATE_KEY;
  const previousPublicKey = process.env.JWT_PUBLIC_KEY;
  const previousRedisUrl = process.env.REDIS_URL;
  const previousSkip = process.env.SKIP_REDIS_CONNECT;

  beforeAll(() => {
    process.env.JWT_PRIVATE_KEY = "-----BEGIN TEST PRIVATE KEY-----";
    process.env.JWT_PUBLIC_KEY = "-----BEGIN TEST PUBLIC KEY-----";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.SKIP_REDIS_CONNECT = "true";
  });

  afterAll(() => {
    process.env.JWT_PRIVATE_KEY = previousPrivateKey;
    process.env.JWT_PUBLIC_KEY = previousPublicKey;
    process.env.REDIS_URL = previousRedisUrl;
    process.env.SKIP_REDIS_CONNECT = previousSkip;
  });

  it("resolves TournamentsService with its queue dependency from the global QueuesModule", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, QueuesModule, TournamentsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(TournamentsService)).toBeInstanceOf(TournamentsService);

    await moduleRef.close();
  });
});
