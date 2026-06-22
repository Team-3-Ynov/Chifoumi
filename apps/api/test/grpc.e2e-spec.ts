import { generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UserRole } from "@chifoumi/db";
import { AUTH_PROTO_PACKAGE, AUTH_PROTO_PATH } from "@chifoumi/proto";
import {
  credentials,
  status as GrpcStatus,
  loadPackageDefinition,
  type ServiceClientConstructor,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { RedisService } from "../src/redis/redis.service.js";

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

type AuthClient = {
  verifyToken: (
    request: { token: string },
    callback: (error: unknown, response: Record<string, unknown>) => void,
  ) => void;
};

type UsersClient = {
  getRating: (
    request: { userId: string },
    callback: (error: unknown, response: Record<string, unknown>) => void,
  ) => void;
};

function createGrpcClients(port: number): { authClient: AuthClient; usersClient: UsersClient } {
  const packageDefinition = loadSync(AUTH_PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = loadPackageDefinition(packageDefinition) as Record<string, unknown>;
  const authPackage = loaded[AUTH_PROTO_PACKAGE] as Record<string, ServiceClientConstructor>;
  const AuthService = authPackage.Auth;
  const UsersService = authPackage.Users;

  const authClient = new AuthService(
    `127.0.0.1:${port}`,
    credentials.createInsecure(),
  ) as AuthClient;
  const usersClient = new UsersService(
    `127.0.0.1:${port}`,
    credentials.createInsecure(),
  ) as UsersClient;

  return { authClient, usersClient };
}

function verifyToken(authClient: AuthClient, token: string): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    authClient.verifyToken({ token }, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolvePromise(response);
    });
  });
}

function getRating(usersClient: UsersClient, userId: string): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    usersClient.getRating({ userId }, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolvePromise(response);
    });
  });
}

function getRatingExpectNotFound(usersClient: UsersClient, userId: string): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    usersClient.getRating({ userId }, (error) => {
      if (error && typeof error === "object" && "code" in error) {
        resolvePromise((error as { code: number }).code);
        return;
      }
      reject(error ?? new Error("Expected gRPC NOT_FOUND error"));
    });
  });
}

describe("gRPC (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;
  let grpcPort: number;
  let authClient: AuthClient;
  let usersClient: UsersClient;
  let jwtService: JwtService;

  beforeAll(async () => {
    grpcPort = 55000 + Math.floor(Math.random() * 1000);
    process.env.API_GRPC_PORT = String(grpcPort);

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
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: AUTH_PROTO_PACKAGE,
        protoPath: AUTH_PROTO_PATH,
        url: `127.0.0.1:${grpcPort}`,
      },
    });
    await app.init();
    await app.startAllMicroservices();
    await app.listen(0, "127.0.0.1");

    prisma = app.get(PrismaService);
    redisService = app.get(RedisService);
    jwtService = new JwtService({
      privateKey: jwtKeys.privateKey,
      publicKey: jwtKeys.publicKey,
      signOptions: { algorithm: "RS256" },
    });

    await prisma.eloHistory.deleteMany();
    await prisma.round.deleteMany();
    await prisma.match.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.eloRating.deleteMany();
    await prisma.user.deleteMany();

    ({ authClient, usersClient } = createGrpcClients(grpcPort));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("VerifyToken accepts a valid token", async () => {
    const user = await prisma.user.create({
      data: {
        email: `grpc-${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "grpc-player",
        role: UserRole.player,
      },
    });
    await prisma.eloRating.create({ data: { userId: user.id } });

    const token = await jwtService.signAsync(
      {
        sub: user.id,
        role: UserRole.player,
        jti: uuidv4(),
        displayName: user.displayName,
      },
      { algorithm: "RS256", expiresIn: 60 },
    );

    const response = await verifyToken(authClient, token);
    expect(response.valid).toBe(true);
    expect(response.userId).toBe(user.id);
    expect(response.displayName).toBe("grpc-player");
  });

  it("VerifyToken rejects revoked tokens", async () => {
    const jti = uuidv4();
    const token = await jwtService.signAsync(
      {
        sub: "11111111-1111-1111-1111-111111111111",
        role: UserRole.player,
        jti,
        displayName: "revoked",
      },
      { algorithm: "RS256", expiresIn: 60 },
    );

    await redisService.revokeAccessToken(jti, 60);
    const response = await verifyToken(authClient, token);
    expect(response.valid).toBe(false);
    expect(response.reason).toBe("REVOKED");
  });

  it("VerifyToken rejects expired tokens", async () => {
    const token = await jwtService.signAsync(
      {
        sub: "11111111-1111-1111-1111-111111111111",
        role: UserRole.player,
        jti: uuidv4(),
        displayName: "expired",
      },
      { algorithm: "RS256", expiresIn: -1 },
    );

    const response = await verifyToken(authClient, token);
    expect(response.valid).toBe(false);
    expect(response.reason).toBe("EXPIRED");
  });

  it("GetRating returns rating for an existing user", async () => {
    const user = await prisma.user.create({
      data: {
        email: `rating-${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "rated-player",
        role: UserRole.player,
      },
    });
    await prisma.eloRating.create({
      data: { userId: user.id, rating: 1337, gamesPlayed: 12 },
    });

    const response = await getRating(usersClient, user.id);
    expect(response.rating).toBe(1337);
    expect(response.gamesPlayed).toBe(12);
  });

  it("GetRating returns NOT_FOUND for an unknown user", async () => {
    const code = await getRatingExpectNotFound(usersClient, "99999999-9999-9999-9999-999999999999");
    expect(code).toBe(GrpcStatus.NOT_FOUND);
  });
});
