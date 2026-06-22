import type { TestingModuleBuilder } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AppModule } from "../app.module.js";
import { API_AUTH_CLIENT } from "../grpc/api-auth.client.js";
import { TestApiAuthClient } from "./test-api-auth.client.js";

export function createGameServiceTestModule(): TestingModuleBuilder {
  return Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(API_AUTH_CLIENT)
    .useClass(TestApiAuthClient);
}
