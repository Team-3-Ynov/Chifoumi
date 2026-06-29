import { status as GrpcStatus } from "@grpc/grpc-js";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ClientGrpc } from "@nestjs/microservices";
import { of, throwError } from "rxjs";
import { UserService } from "./user.service.js";

describe("UserService gRPC client", () => {
  const grpcUsers = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updatePassword: jest.fn(),
    getRating: jest.fn(),
    getCurrentProfile: jest.fn(),
    getPublicProfile: jest.fn(),
    listUsers: jest.fn(),
    listLeaderboard: jest.fn(),
    getCompetitionStats: jest.fn(),
  };
  const client = {
    getService: jest.fn(() => grpcUsers),
  };
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(client as unknown as ClientGrpc);
    service.onModuleInit();
  });

  it("maps a found user record from the user microservice", async () => {
    grpcUsers.findByEmail.mockReturnValue(
      of({
        found: true,
        id: "user-1",
        email: "a@b.com",
        passwordHash: "hash",
        displayName: "alice",
        role: "player",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    await expect(service.findByEmail("a@b.com")).resolves.toEqual({
      id: "user-1",
      email: "a@b.com",
      passwordHash: "hash",
      displayName: "alice",
      role: "player",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  it("returns null when the user microservice reports no match", async () => {
    grpcUsers.findById.mockReturnValue(of({ found: false }));

    await expect(service.findById("missing")).resolves.toBeNull();
  });

  it("recognizes unique constraint errors from gRPC ALREADY_EXISTS", async () => {
    const error = { code: GrpcStatus.ALREADY_EXISTS };
    grpcUsers.createUser.mockReturnValue(throwError(() => error));

    await expect(
      service.createUser({ email: "a@b.com", passwordHash: "hash", displayName: "alice" }),
    ).rejects.toBe(error);
    expect(service.isUniqueConstraintError(error)).toBe(true);
  });

  it("maps missing public profiles to a REST 404", async () => {
    const error = { code: GrpcStatus.NOT_FOUND };
    grpcUsers.getPublicProfile.mockReturnValue(throwError(() => error));

    await expect(service.getPublicProfile("missing")).rejects.toMatchObject({
      status: 404,
      response: { error: "USER_NOT_FOUND" },
    });
  });
});
