import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueuesModule } from "../queues/queues.module.js";
import { SeasonsModule } from "./seasons.module.js";
import { SeasonsService } from "./seasons.service.js";

// Guards the DI wiring that the unit tests cannot see: SeasonsService depends on
// SeasonsQueueService, which itself needs QUEUE_CONFIG. That token only resolves
// because the @Global QueuesModule now *exports* the queue service — otherwise
// Nest fails to build the graph at NestFactory.create (the e2e boot crash).
describe("SeasonsModule wiring", () => {
  const previousRedisUrl = process.env.REDIS_URL;
  const previousSkip = process.env.SKIP_REDIS_CONNECT;

  beforeAll(() => {
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.SKIP_REDIS_CONNECT = "true";
  });

  afterAll(() => {
    process.env.REDIS_URL = previousRedisUrl;
    process.env.SKIP_REDIS_CONNECT = previousSkip;
  });

  it("resolves SeasonsService with its queue dependency from the global QueuesModule", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, QueuesModule, SeasonsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(SeasonsService)).toBeInstanceOf(SeasonsService);

    await moduleRef.close();
  });
});
