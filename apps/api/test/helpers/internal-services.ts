import { createServer } from "node:net";
import { AUTH_PROTO_PACKAGE, AUTH_PROTO_PATH } from "@chifoumi/proto";
import type { DynamicModule, ForwardReference, INestApplication, Type } from "@nestjs/common";
import { type MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { AppModule as AuthServiceAppModule } from "../../../auth-service/src/app.module.js";
import { AppModule as UserServiceAppModule } from "../../../user-service/src/app.module.js";

type ProviderOverride = {
  token: Parameters<TestingModuleBuilder["overrideProvider"]>[0];
  value: unknown;
};

type ModuleImport = Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference;

export type InternalServicesHandle = {
  authGrpcUrl: string;
  userGrpcUrl: string;
  close: () => Promise<void>;
};

type StartInternalServicesOptions = {
  authProviderOverrides?: ProviderOverride[];
};

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate a TCP port")));
        return;
      }

      const { port } = address;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function createGrpcApp(module: ModuleImport, grpcUrl: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [module],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: AUTH_PROTO_PACKAGE,
      protoPath: AUTH_PROTO_PATH,
      url: grpcUrl,
    },
  });
  await app.startAllMicroservices();
  await app.init();
  return app;
}

export async function startInternalAuthUserServices(
  options: StartInternalServicesOptions = {},
): Promise<InternalServicesHandle> {
  const userGrpcUrl = `127.0.0.1:${await getFreePort()}`;
  process.env.USER_SERVICE_GRPC_URL = userGrpcUrl;

  const userApp = await createGrpcApp(UserServiceAppModule, userGrpcUrl);

  const authGrpcUrl = `127.0.0.1:${await getFreePort()}`;
  process.env.AUTH_SERVICE_GRPC_URL = authGrpcUrl;

  let authBuilder = Test.createTestingModule({
    imports: [AuthServiceAppModule],
  });
  for (const override of options.authProviderOverrides ?? []) {
    // biome-ignore lint/correctness/useHookAtTopLevel: Nest testing override API, not a React hook.
    authBuilder = authBuilder.overrideProvider(override.token).useValue(override.value);
  }
  const authModuleRef = await authBuilder.compile();
  const authApp = authModuleRef.createNestApplication();
  authApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: AUTH_PROTO_PACKAGE,
      protoPath: AUTH_PROTO_PATH,
      url: authGrpcUrl,
    },
  });
  await authApp.startAllMicroservices();
  await authApp.init();

  return {
    authGrpcUrl,
    userGrpcUrl,
    close: async () => {
      await authApp.close();
      await userApp.close();
    },
  };
}
