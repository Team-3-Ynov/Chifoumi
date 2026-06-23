import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ListUsersQueryDto } from "./dto/list-users-query.dto.js";
import { UsersController } from "./users.controller.js";
import type { AdminUsersPage, UsersService } from "./users.service.js";

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
