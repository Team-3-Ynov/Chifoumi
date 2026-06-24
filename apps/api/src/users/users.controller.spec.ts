import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type ExecutionContext, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { ListUsersQueryDto } from "./dto/list-users-query.dto.js";
import { UsersController } from "./users.controller.js";
import type { AdminUsersPage } from "./users.service.js";
import { UsersService } from "./users.service.js";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: {
    listUsers: ReturnType<typeof jest.fn>;
    getPublicProfile: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    usersService = {
      listUsers: jest.fn(),
      getPublicProfile: jest.fn(),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  describe("listUsers", () => {
    it("delegates to the service with the query pagination", async () => {
      const page: AdminUsersPage = { items: [], total: 0, page: 1, limit: 20 };
      usersService.listUsers.mockResolvedValue(page);

      const query = new ListUsersQueryDto();
      query.page = 1;
      query.limit = 20;

      const result = await controller.listUsers(query);

      expect(result).toBe(page);
      expect(usersService.listUsers).toHaveBeenCalledWith(1, 20);
    });
  });
});

describe("UsersController — guard wiring (AC6)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: { listUsers: jest.fn(), getPublicProfile: jest.fn() },
        },
        // Real RolesGuard — the 403 comes from actual guard logic, not a stub.
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest<{ user: unknown }>().user = { role: "player" };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it("returns 403 when the caller is not an administrator", async () => {
    const { status, body } = await request(app.getHttpServer()).get("/users");
    expect(status).toBe(403);
    expect(body).toMatchObject({ error: "FORBIDDEN" });
  });
});
